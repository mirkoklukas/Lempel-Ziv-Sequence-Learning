
var StateSpace = require('./simple-state-space');
// var logger = require('winston');
var logger = require('./logger.js')
var chalk = require('chalk');
// logger.level = 'debug';
logger.level = 'info';
// logger.level = 100


var SequenceCoder = function (config) {
    logger.info(`New Lempel-Ziv Sequence coder initialized`);
    logger.info(`(a back shift parameter of 0 ` +
                `corresponds to the regular LZ78 algorithm)`);
    this.stateSpace = new StateSpace({
        'alphabet': config.alphabet,
        'predictionThreshold': config.predictionThreshold || 1,
        'initialWeight': config.initialWeight || 1
    });
    this.incr = config.incr || 1;
    this.decr = config.decr || 0.0;
    this.predictionThreshold = config.predictionThreshold || 1;
    this.reignitionThreshold = config.reignitionThreshold || 1;
    this.backShift = config.backShift || 0; 
};


SequenceCoder.prototype.transition = function (listOfStates, x) {
    var stateSpace = this.stateSpace;

    return stateSpace
            .getStableSuccessors(listOfStates)
            .filter((successor) => stateSpace.getBase(successor) === x);
};

SequenceCoder.prototype.defineTransition = function (sources, x, targets) {
    this.stateSpace.addConnections(sources, targets); 
    return targets;
};

SequenceCoder.prototype.learnSequence = function (inputSequence, currentState, lastIgnition) {
    
    logger.debug("Learn sequence:", inputSequence.join(" "))
    var lastIgnition = lastIgnition || 0;
    var currentState = currentState || [];
    var pos = 0;
    var result = [lastIgnition, currentState, pos];
    while(pos < inputSequence.length) {
        if(pos % 100 == 0) console.log(pos, inputSequence.length)
        result = this.learn(inputSequence, lastIgnition, currentState, pos);
        lastIgnition = result[0];
        currentState = result[1];
        pos          = result[2];
    }
    return [currentState, lastIgnition]
};

Array.prototype.toString = function () {
    // return "aaa"
    return `[${this.join(",")}]`
};

SequenceCoder.prototype.learn = function (inputSequence, lastIgnition, prevState, pos) {
    'use strict';
    var x            = inputSequence[pos];
    var lastIgnition = prevState.length === 0? pos: lastIgnition;
    var backShift    = this.backShift;
    var stateSpace   = this.stateSpace;
    var nextState    = this.transition(prevState, x);
    var nextPos;

    // DEBUG LOGGING
    logger.debug(chalk.bold(`<learn>`))
    logger.debug(chalk.reset(`input:`), `s=${prevState}, x=\"${inputSequence[pos]}\" at pos=${pos}, \"${inputSequence.map((x,i)=> i==pos ? '('+ x + ')' :x).slice(Math.max(pos-5,0),pos+10).join("")}\"`)
    logger.debug(chalk.reset(`transition:`), `(${prevState}, ${x}) |---> ${nextState}`);
    
    if(nextState.length === 0) {
        /* 
         * Learn: There is no next state to step on. Extend the graph by 
         * a new state over x (and its respective connections)
         */

        /*
         * Get best match: 
         *  - if there are already states in the fibre over x 
         *  with non-stable connections, get the best one. 
         *  - if there are no unstable ones, create a new one.
         *  
         * (Here is a point where we have to decide which connections 
         * we want to improve. All possible ones or just 
         * strengthen the existing edges.)
         */ 
        // let newState = stateSpace.createStateOverInputAndExposeToIgnition(x)
        let newState = stateSpace.createStateOver(x);
        this.defineTransition(prevState, x, newState);
        nextState = []; 
        nextPos   = Math.max(pos - backShift + 1, lastIgnition);

        // DEBUG LOGGING
        logger.debug("create new state:", `${newState}`);
        logger.debug("define transition:", `(${prevState}, ${x}) |--> ${newState}` )
        logger.debug("Learned phrase:", `${inputSequence.slice(lastIgnition, pos + 1)}`);
        logger.debug(chalk.reset(`Continue`), `(with back shift ${backShift}): Move ${nextPos - pos} step(s) and continue in state ${nextState} `)
    } else {
        /* 
         * Continue: Step on next state.
         */
        // this.improveConnections(prevState, nextState);
        this.improveConnectionsWithoutFormingNewOnes(prevState, nextState);
        nextPos = pos + 1;

        // DEBUG LOGGING
        logger.debug("improve connections:", `${prevState} ---> ${nextState}` )
        logger.debug(chalk.reset("Continue (no back shift):"), `Move ${nextPos - pos} step(s) and continue in state ${nextState} `)
    }

    // DEBUG
    logger.debug(chalk.bold("</learn>\n"))

    return [lastIgnition, nextState, nextPos];
};

SequenceCoder.prototype.improveConnections = function (feedingState, learningState) {
    'use strict';
    for (let l of learningState ) {
        for(let f of feedingState ) {
            this.stateSpace.addDeltaToWeight(f,l, this.incr); }}

    return this;
};

SequenceCoder.prototype.improveConnectionsWithoutFormingNewOnes = function (feedingState, learningState) {
    'use strict';
    for (let l of learningState ) {
        for(let f of feedingState ) {
            if(this.stateSpace.getWeight(f,l) > 0) { 
                this.stateSpace.addDeltaToWeight(f,l, this.incr); 
            }
        }
    }

    return this;
}


module.exports = SequenceCoder;








