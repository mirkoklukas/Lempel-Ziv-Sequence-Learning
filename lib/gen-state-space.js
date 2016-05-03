var logger = require('winston');
// var logger = require('./logger.js')
var chalk = require('chalk');
logger.level = 'debug';

/*
 * 
 * 
 *
 */
var StateSpace = function (config) {
    var config = config || {}
    this.states = [];
    this.segments = [];
    this.numStates = 0;
    this.numSegments = 0;

    this.zero = {};
    this.fibre = {};
    this.base = {};

    this.listeningSegments = {};
    this.feedingSegments = {};
    this.listeningCell = {};
    this.feedingCells ={};
    this.segmentWeights = {}

    this.initialWeight = config.initialWeight || 1;
    this.alphabet = config.alphabet || [];
    this.theta = config.theta || 1;

    for(var x of this.alphabet) { 
        if(!(x in this.fibre)) {
            this.fibre[x] = [];
        }
            
    }

};

StateSpace.prototype.fromSerialized = function (data) {
    this.states = data.states;
    this.segments = data.segments;
    this.numStates = data.numStates;
    this.numSegments = data.numSegments;

    this.zero = data.zero;
    this.fibre = data.fibre;
    this.base = data.base;

    this.listeningSegments = data.listeningSegments;
    this.feedingSegments = data.feedingSegments;
    this.listeningCell   = data.listeningCell;
    this.feedingCells    = data.feedingCells;
    this.segmentWeights  = data.segmentWeights;

    this.initialWeight = data.initialWeight;
    this.alphabet = data.alphabet;
    this.theta = data.theta;
    return this;
};

StateSpace.prototype.generateStateId = function () {
    "use strict";
    this.numStates += 1;
    return "s" + this.numStates;
};
StateSpace.prototype.generateSegmentId = function () {
    "use strict";
    this.numSegments += 1;
    return "e" + this.numSegments;
};

StateSpace.prototype.initializeZeros = function () {
    "use strict";
    for(var x of this.alphabet) { 
        if(!(x in this.zero)) {
            let id = this.generateStateId()
            this.zero[x] = [id]; 
            this.addStateOver(x, id)
        }
    }
    return this;
}



StateSpace.prototype.getZero= function (x) {
    return this.zero[x];
};

StateSpace.prototype.getBase = function (stateId) {
    return this.base[stateId];
};

StateSpace.prototype.getFibre = function (x) {
    return this.fibre[x];
};

StateSpace.prototype.addStateOver = function (base, states) {
    if( !(states instanceof Array)) {
        states = [states]
    }
    for (state of states) { 
        this.states.push(state)
        this.fibre[base].push(state);
        this.base[state] = base;
        this.listeningSegments[state] = [];
        this.feedingSegments[state] = [];
    }
    return this;
};

StateSpace.prototype.createStateOver = function (base) {
    "use strict";
    let state = this.generateStateId();
    logger.debug("create new state: ", base, state)
    this.addStateOver(base, state);
    return state;
};

StateSpace.prototype.createSegment = function (listOfStates, singleState) {
    "use strict";
    logger.debug("create new segment: ", listOfStates, singleState)
    if(singleState instanceof Array) throw "single state shouldn'd be a list";
    var seg = this.generateSegmentId();
    this.segments.push(seg);
    this.segmentWeights[seg] = this.initialWeight;
    this.feedingCells[seg] = listOfStates;
    this.listeningCell[seg] = singleState;
    this.feedingSegments[singleState].push(seg);
    for (let i=listOfStates.length-1; i>=0; i--) {
        let feedState=listOfStates[i];
        this.listeningSegments[feedState].push(seg);
    }
    return seg;
};




StateSpace.prototype.bitwiseTransition = function (listOfStates, x) {
    "use strict";
    let theta = this.theta;

    let scores = {};
    
    let activeSegs = [];
    let activeSegsToX = [];
    
    let activeCells = [];
    let activeCellsOverX = [];
    
    let segsToken = {};
    let cellsToken = {};

    for (let i=listOfStates.length-1; i>=0; i--) {
        let state = listOfStates[i];

        let listeningSegments = this.listeningSegments[state];

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
                    
                    let lisCell = this.listeningCell[seg];

                    if (cellsToken[lisCell] != true) {
                        cellsToken[lisCell] = true;
                        activeCells.push(lisCell);

                        if( this.getBase(lisCell) == x ) {
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

StateSpace.prototype.increaseWeights = function (listOfSegments, weight) {
    "use strict";
    for (let i=listOfSegments.length - 1; i>=0; i--) {
        let seg = listOfSegments[i];
        this.segmentWeights[seg] += weight
    }
    return this;
};



StateSpace.prototype.inspectSegment = function (seg) {
    "use strict";
    let feedingCells = this.feedingCells[seg]
    let listeningCell = this.listeningCell[seg]
    return  `<Segment> \nid: ${seg}\nfc: ${feedingCells} ` +
            // `\nb: ${feedingCells.map(cell => this.base[cell])}` + 
            `\nlc: ${listeningCell}` +
            `\n</Segment>`;
};




/*
 *
 */
module.exports = StateSpace

