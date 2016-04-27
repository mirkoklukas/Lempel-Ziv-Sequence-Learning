
var StateSpace = require('./gen-state-space');
var logger = require('winston');
// var logger = require('./logger.js')
var chalk = require('chalk');
// logger.level = 'debug';
logger.level = 'info';



var SequenceCoder = function (config) {

    this.incr = config.incr || 1;
    this.decr = config.decr || 0.0;
    this.theta = config.theta;
    this.alphabet = Array.from(new Set(config.alphabet));
    this.size = this.alphabet.length;
    this.sparseness = config.sparseness || 1;

    this.stateSpace = new StateSpace({
        'alphabet': this.alphabet,
        'theta': this.theta
    });
};

SequenceCoder.prototype.initializeZeros = function () {
    this.stateSpace.initializeZeros();
    return this;
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

SequenceCoder.prototype.neighbors = function (listOfStates) {
    "use strict";
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

                    }
                }         
            } 
        }
    }

    return activeCells;
};


SequenceCoder.prototype.learnSequence = function (inputSequence) {
    "use strict";
    logger.info(chalk.bold.green("Learning Sequence"), `total length: ${inputSequence.length}`)
    var n = inputSequence.length;
    var W_prev = [];
    var W_next = [];
    var t = 0;
    var stateSpace = this.stateSpace;


    while (t < n) {
        if(t%2000 == 0) logger.info(`...learned ${t} of ${inputSequence.length}...`);
        
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

Array.prototype.toString = function () {
    // return "aaa"
    return `[${this.join(",")}]`
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








