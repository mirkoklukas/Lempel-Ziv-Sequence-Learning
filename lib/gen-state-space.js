var logger = require('winston');
// var logger = require('./logger.js')
var chalk = require('chalk');
logger.level = 'debug';

/*
 *
 */
var stateId = (function () {
    var id = 0;
    return function () {
        return id++;
    };
})();


var segId = (function () {
    var id = 0;
    return function () {
        return id++;
    };
})();

/*
 * 
 * 
 *
 */
var StateSpace = function (config) {
    this.states = [];
    this.segments = [];

    this.zero = {};
    this.fibre = {};
    this.base = {};

    this.listeningSegments = {};
    this.feedingSegments = {};
    this.listeningCell = {};
    this.feedingCells ={};
    this.segmentWeights = {}

    this.alphabet = config.alphabet;
    this.theta = config.theta || 1;

    for(var x of config.alphabet) { 
        if(!(x in this.fibre)) {
            this.fibre[x] = [];
        }
            
    }

};

StateSpace.prototype.initializeZeros = function () {
    "use strict";
    for(var x of this.alphabet) { 
        if(!(x in this.zero)) {
            let id = stateId()
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
    let state = stateId();
    this.addStateOver(base, state);
    return state;
};

StateSpace.prototype.createSegment = function (listOfStates, singleState) {
    "use strict";
    logger.debug("create segment: ", listOfStates, singleState)
    if(singleState instanceof Array) throw "list";
    var seg = segId();
    this.segments.push(seg);
    this.segmentWeights[seg] = 1;
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



StateSpace.prototype.inspectSpaceOverBases = function (listOfBases) {
    "use strict";
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

