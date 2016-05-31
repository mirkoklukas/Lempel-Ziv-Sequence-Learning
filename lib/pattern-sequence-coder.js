
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
             logger.debug(`add to zero: ${tilde_x_new}`)
            this.stateSpace.addZero(x, tilde_x_new);
        }

    } else {

        let tilde_x_new = this.stateSpace.createStateOver(x);
        this.stateSpace.createSegment(listOfStates, tilde_x_new);

    }

    logger.debug(chalk.bold("</extend>"))
    return this;
};

SequenceCoder.prototype._reinforce = function (listOfSegments) {
    logger.debug(chalk.bold("<reinforce>"), `listOfSegments: ${listOfSegments}`)
    this.stateSpace.increaseWeights(listOfSegments, 1)
    logger.debug(chalk.bold("</reinforce>"))
    return this;
};

SequenceCoder.prototype._ignite = function (x) {
    "use strict";

    let ign = this.stateSpace.getZero(x)

    return ign;
};

SequenceCoder.prototype._suppress = function (prediction, actualPattern) {
};

SequenceCoder.prototype.learn = function (pattern, lastSt, lastPred) {
    "use strict";
    let X              = pattern;
    let lastState      = lastSt      || this.lastState;
    let lastPrediction = lastPred || this.lastPrediction;
    let nextState      = [];

    logger.debug(chalk.bold.red("<learn>"), `pattern: ${X}, lastState: ${lastState}, lastPrediction: ${JSON.stringify(lastPrediction)}`)


    for (let i = X.length - 1; i >= 0; i--) {
        let x = X[i];

        /* FIBRE-WISE LIFT */
        let x_tilde = x in lastPrediction ? lastPrediction[x]['cells'] : [];

        /* CHECK FOR 'DEATH' AND POSSIBLY IGNITE*/
        if (x_tilde.length == 0) {

                this._extend(lastState, x)
                x_tilde = this._ignite(x);
                logger.debug(`ignite ${x} yields ${x_tilde}`)

        } else {                    
                this._reinforce(lastPrediction[x]['segments']);
        }

        /* COMBINE FIBRE-WISE LIFTS */
        for (let j=x_tilde.length-1; j>= 0; j--) {

                nextState.push(x_tilde[j]);

        }
    } 

    this._suppress(this.lastPrediction, X);
    
    // let nextPrediction = this._predict(nextState);
    let rawPrediction = this._computeWeightedPrediction(nextState);


    let nextPrediction = rawPrediction['PredictionByBase'];
    this.lastState      = nextState;
    this.lastPrediction = nextPrediction;
    
    /* 
     *  compute what should be outputted to be consumed by the next layer 
     */

    let output = this._computeOutput(rawPrediction['cells'], rawPrediction['weightByCell'], X, nextState)


    logger.debug(chalk.red("</learn>"))

    // return 

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

SequenceCoder.prototype.learnSequenceExtended = function (inputSequence) {
    "use strict";
    logger.debug(chalk.bold.green("Learning Sequence"), `total length: ${inputSequence.length}`)
    let n = inputSequence.length;
    let W_prev = this.currentState;
    let W_next = this.currentState;
    let t = 0;
    let stateSpace = this.stateSpace;
    let learningHistory = [];
    let prediction = this.computePrediction(W_prev);

    while (t < n) {
        if(t%2000 == 0) logger.debug(`...learned ${t} of ${inputSequence.length}...`);
        
        let X  = inputSequence[t];
        W_prev = W_next;
        // W_prev = W_next.slice();
        W_next = [];

        

        logger.debug(chalk.bold.blue.underline(`Learning step ${t+1} of ${n}`))
        logger.debug(`W_prev = ${W_prev}`);
        logger.debug(`X[t] = ${inputSequence[t]}`);
        logger.debug(`Pred(W_prev) = ${JSON.stringify(prediction)}`);


        for (let i = X.length - 1; i >= 0; i--) {
            let x = X[i];
            // let x_tilde = this.bitwiseTransition(W_prev, x);
            let x_tilde = x in prediction ? prediction[x]['cells'] : [];
            let w_tilde;

            logger.debug(chalk.reset(`lift of ${x} : ${x_tilde}`))

            if (x_tilde.length == 0) {
                logger.debug(chalk.bold(`Death `))
                let x_new = stateSpace.createStateOver(x);
                stateSpace.createSegment(W_prev, x_new);
                w_tilde = stateSpace.getZero(x);

            } else {
                logger.debug(chalk.bold(`Continueing (no death)`))
                // @todo: increase weight of edges/segments
                stateSpace.increaseWeights(prediction[x]['segments'], 1)
                w_tilde = x_tilde
            }

            for (let j=w_tilde.length-1; j>= 0; j--) {
                W_next.push(w_tilde[j]);
            }
        } 
        
        this.currentState = W_next;
        prediction = this.computePrediction(W_next);

        t = t + 1;

        learningHistory.push({
            'pattern': X, 
            'lift': W_next, 
            'prediction': prediction
        });
    }

    return learningHistory;

};

/*
 *  [...state id's] |---->  {   ...[base_id]: 
 *                              { 
 *                                  'states'  : [...id's]
 *                                  'segments': [...id's]
 *                              }
 *                          }
 */
SequenceCoder.prototype.computePrediction = function (listOfStates) {
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

SequenceCoder.prototype._predict = SequenceCoder.prototype.computePrediction;

SequenceCoder.prototype.learnSequence = function (inputSequence) {
    "use strict";
    logger.debug(chalk.bold.green("Learning Sequence"), `total length: ${inputSequence.length}`)
    var n = inputSequence.length;
    var W_prev = [];
    var W_next = [];
    var t = 0;
    var stateSpace = this.stateSpace;


    while (t < n) {
        if(t%2000 == 0) logger.debug(`...learned ${t} of ${inputSequence.length}...`);
        
        let X  = inputSequence[t];
        W_prev = W_next.slice();
        W_next = [];

        for (let i = X.length - 1; i >= 0; i--) {
            let x = X[i];
            let x_tilde = this.bitwiseTransition(W_prev, x);
            let w_tilde;


            if (x_tilde.length == 0) {
                let x_new = stateSpace.createStateOver(x);
                stateSpace.createSegment(W_prev, x_new);
                w_tilde = stateSpace.getZero(x);

            } else {
                // @todo: increase weight of edges/segments
                w_tilde = x_tilde
            }

            for (let j=w_tilde.length-1; j>= 0; j--) {
                W_next.push(w_tilde[j]);
            }
        } 

        t = t + 1;
    }

};

/*
 *  ([id's], base) |---> [id's over x]
 */
SequenceCoder.prototype.bitwiseTransition = function (listOfStates, x) {
    "use strict";
    logger.debug("bitwiseTransition:", listOfStates, x)

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

                        if( stateSpace.getBase(lisCell) == x ) {
                            activeCellsOverX.push(lisCell);
                            activeSegsToX.push(seg);
                        }
                    }
                }         
            } 
        }
    }

    return activeCellsOverX;
};





SequenceCoder.prototype.inspect = function () {
    "use strict";
    var coder = this;
    var str = ""
    var str2 = ''
    for (var key in this) {
        if (this.hasOwnProperty(key)) {
            // let body = JSON.stringify(coder[key])
            // str += `\n ----> ${key}: ${body}\n\n`;
            str2 += `\n${key}` + JSON.stringify(coder[key])
            // str2 += body
        }
    }
    return str + str2;
};


module.exports = SequenceCoder;








