
var StateSpace = require('./gen-state-space');
var GeoPooler = require('./geo-pooler.js')
var chalk = require('chalk');
var logger = require('winston');
// logger.level = 'debug';
logger.level = 'info';

var SequenceCoder = function (config) {
    var config = config || {}
    this.incr = config.incr || 1;
    this.decr = config.decr || 0.0;
    this.alphabet = Array.from(new Set(config.alphabet));
    this.size = this.alphabet.length;
    this.sparseness = config.sparseness;
    this.theta = config.theta || this.sparseness;

    this.lastState   = [];
    this.lastPrediction = {}

    this.geoPooler = new GeoPooler(this.alphabet);

    this.stateSpace = new StateSpace({
        'alphabet': this.alphabet,
        'theta': this.theta
    });

};


SequenceCoder.prototype.fromSerialized = function (obj) {
    this.incr  = obj.incr;
    this.decr  = obj.decr;
    this.theta = obj.theta;
    this.alphabet = obj.alphabet;
    this.size     = this.alphabet.length;
    this.sparseness   = obj.sparseness;
    this.stateSpace   = new StateSpace().fromSerialized(obj.stateSpace);
    this.lastState   = [];
    this.lastPrediction = {}
    return this;
};

SequenceCoder.prototype.reset = function () {
    this.lastState   = [];
    this.lastPrediction = {}
};

SequenceCoder.prototype.initializeZeros = function () {
    this.stateSpace.initializeZeros();
    return this;
};

SequenceCoder.prototype._extend = function (listOfStates, x) {
    "use strict";
    logger.debug(chalk.bold("<extend>"), `listOfStates: ${listOfStates}, x: ${x}`)
    if(listOfStates.length == 0) {

        if (this._ignite(x).length == 0) { 

            let tilde_x_new = this.stateSpace.createStateOver(x);
            this.stateSpace.addZero(x, tilde_x_new);

        }

    } else {

        let tilde_x_new = this.stateSpace.createStateOver(x);
        this.stateSpace.createSegment(listOfStates, tilde_x_new);

    }

    logger.debug(chalk.bold("</extend>"))
    return this;
};


SequenceCoder.prototype._ignite = function (x) {
    "use strict";
    let ign = this.stateSpace.getZero(x);
    return ign;
};

SequenceCoder.prototype._reinforce = function (listOfSegments) {
    logger.debug(chalk.bold("<reinforce>"), `listOfSegments: ${listOfSegments}`)
    this.stateSpace.increaseWeights(listOfSegments, 1)
    logger.debug(chalk.bold("</reinforce>"))
    return this;
};

SequenceCoder.prototype._suppress = function (prediction, actualPattern) {
};

SequenceCoder.prototype.learn = function (pattern, lastSt, lastPred) {
    "use strict";
    let X              = pattern;
    let lastState      = lastSt   || this.lastState;
    let lastPrediction = lastPred || this.lastPrediction;
    let nextState      = [];

    logger.debug(chalk.bold.red("<learn>"), `pattern: ${X}, lastState: ${lastState}, lastPrediction: ${JSON.stringify(lastPrediction)}`)

    this._suppress(this.lastPrediction, X);

    /* 
     *  COMPUTE NEXT STATE
     */
    for (let i = X.length - 1; i >= 0; i--) {
        let x = X[i];

        /* FIBRE-WISE LIFT */
        let x_tilde = x in lastPrediction ? lastPrediction[x]['cells'] : [];

        /* CHECK FOR 'DEATH' AND POSSIBLY IGNITE*/
        if (x_tilde.length == 0) {

                this._extend(lastState, x)
                x_tilde = this._ignite(x);

        } else {

                this._reinforce(lastPrediction[x]['segments']);

        }

        /* COMBINE FIBRE-WISE LIFTS */
        for (let j=x_tilde.length-1; j>= 0; j--) {

                nextState.push(x_tilde[j]);

        }
    } 

    this.lastState = nextState;

    let rawPrediction = this._computeWeightedPrediction(nextState);
    
    this.lastPrediction = rawPrediction['PredictionByBase'];
    
    /* 
     *  Compute what should be projected upwards to be consumed by the next layer 
     */
    let output = this._computeOutput(rawPrediction['cells'], rawPrediction['weightByCell'], X, nextState)

    logger.debug(chalk.red("</learn>"))

    return output;

};

SequenceCoder.prototype._computeOutput = function (states, weightMap, X, lift) {
    "use strict";
    let geo = this.stateSpace.geoHeight;
    let setX = new Set(X);
    let output = states.filter(s => !setX.has(this.stateSpace.getBase(s)))
                        .sort((a,b) =>  geo[b]*weightMap[b] - geo[a]*weightMap[a])
                        .slice(0, this.sparseness)
                        .concat(lift)
                        .map(s => this.stateSpace.getHairyProjection(s));

    let projectedOutput = this.geoPooler.apply(output, this.sparseness)
    return projectedOutput;
};

SequenceCoder.prototype._computeWeightedPrediction = function (listOfStates) {
    "use strict";

    let prediction = {}
    let predictionMap = {}

    let theta = this.theta;
    let stateSpace = this.stateSpace;
    
    let activeSegs = [];
    let activeSegsToX = [];
    
    
    /* Compute segment scores*/
    let scores = {};
    let touchedSegments = [];
    for (let i=listOfStates.length-1; i>=0; i--) {
        let state = listOfStates[i];
        let listeningSegments = stateSpace.listeningSegments[state];
        for (let j=listeningSegments.length-1; j>=0; j--) {
            let seg = listeningSegments[j];

            if(!(seg in scores)) touchedSegments.push(seg);
            let score = scores[seg];

            if (score == undefined) score = 1;
            else score += 1;            

            scores[seg] = score;
        }
    }

    /* Filter segments by score and return active segments */
    let activeSegments = [];
    for (let i=touchedSegments.length-1; i>=0; i--) {
        let seg = touchedSegments[i];
        if (scores[seg] >= theta) {
            activeSegments.push(seg);
        }
    }

    /* 
     *  we assume that there is only one segment for each state cell
     *  that is a simplifying assumption, it should be satisfied under 
     *  the current learning rule, as long as theta is bigger than k/2?? 
     */
    let cells = [];
    let weights = [];
    let weightByCell = {}
    let totalWeight = 0;
    for (let i=activeSegments.length-1; i>=0; i--) {

        let seg = activeSegments[i];
        let cell = stateSpace.listeningCell[seg];
        let base = stateSpace.getBase(cell);
        let weight = stateSpace.segmentWeights[seg];
        let score = scores[seg];
        totalWeight += weight;
        cells.push(cell);
        weights.push(weight);
        weightByCell[cell] = weight;
        if(base in predictionMap) {
            predictionMap[base]['cells'].push(cell)
            predictionMap[base]['segments'].push(seg)
            // predictionMap[base]['weights'].push(weight)
            // predictionMap[base]['scores'].push(score)
        } else {
            predictionMap[base] = {
                'cells': [cell],
                'segments': [seg]
            }
        }

    }

    return {
        'weightByCell': weightByCell,
        'weights': weights,
        'cells': cells,
        'PredictionByBase': predictionMap,
        'totalWeight': totalWeight
    };
};

/*
 *
 */
SequenceCoder.prototype._computePrediction = function (listOfStates) {
    "use strict";
    
    let prediction = {}

    let theta = this.theta;
    let stateSpace = this.stateSpace;
    let scores = {};
    
    let activeSegs = [];
    let activeSegsToX = [];
    
    let activeCells = [];
    let activeCellsOverX = [];
    
    let segsToken = {};
    let cellsToken = {};

    for (let i=listOfStates.length-1; i>=0; i--) {
        let state = listOfStates[i];

        let listeningSegments = stateSpace.listeningSegments[state];

        for (let j=listeningSegments.length-1; j>=0; j--) {
            let seg = listeningSegments[j];

            let score = scores[seg];


            if (score == undefined) {
                score = 1;
            } else {
                score += 1;
            }
            
            scores[seg] = score;

            if(score >= theta) {

                if(segsToken[seg] != true) {
                    segsToken[seg] = true;
                    activeSegs.push(seg)
                    
                    let lisCell = stateSpace.listeningCell[seg];

                    if (cellsToken[lisCell] != true) {
                        cellsToken[lisCell] = true;
                        activeCells.push(lisCell);

                        let x =stateSpace.getBase(lisCell)
                        if( x in prediction) { 
                            prediction[x]['cells'] = push(lisCell)
                            prediction[x]['segments'] = push(seg)
                        } else {
                            prediction[x] = {
                                'cells': [lisCell],
                                'segments': [seg]
                            };
                        }

                    } else {
                        prediction[x]['segments'] = push(seg)
                    }
                }         
            } 
        }
    }

    return prediction
};

SequenceCoder.prototype._predict = SequenceCoder.prototype._computePrediction;



module.exports = SequenceCoder;








