
var StateSpace = require('./simple-state-space');
var logger = require('./logger.js');
var chalk = require('chalk');
logger.level = 'debug';
// logger.level = 'info';


var SequenceCoder = function (config) {
    logger.info(`New Lempel-Ziv Sequence coder initialized:`, config);
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
    return this;
};

SequenceCoder.prototype.learnSequence = function (inputSequence) {
    
    logger.info("Learn sequence:", inputSequence.join(" "))
    var lastIgnition = 0;
    var currentState = [];
    var pos = 0;
    var result = [lastIgnition, currentState, pos];
    while(pos < inputSequence.length) {
        result = this.learn(inputSequence, lastIgnition, currentState, pos);
        lastIgnition = result[0];
        currentState = result[1];
        pos          = result[2];
    }

};

Array.prototype.toString = function () {
    // return "aaa"
    return `[${this.join(",")}]`
};

SequenceCoder.prototype.learn = function (inputSequence, lastIgnition, prevState, pos) {
    'use strict';
    // logger.debug("Learning:", `s=${JSON.stringify(prevState)}, x=\"${inputSequence[pos]}\" at pos=${pos}`)
    logger.debug(chalk.bold("<learn>"))
    logger.debug("input:", `s=${prevState}, x=\"${inputSequence[pos]}\" at pos=${pos}, \"${inputSequence.map((x,i)=> i==pos ? '('+ x + ')' :x).join("")}\"`)
    var x         = inputSequence[pos];
    var nextState = [];
    var nextPos;
    var lastIgnition = lastIgnition;
    var backShift    = this.backShift;
    var stateSpace   = this.stateSpace

    if(prevState.length === 0) {
        /* 
         * Ignition. We did fall of the state graph in the last step, 
         * this is now the first step back onto it." 
         */
        lastIgnition = pos;
        nextState = this.transition(prevState, x)
        // nextState = this.stateSpace.getFibre(x);

        // DEBUG
        logger.debug(chalk.reset("ignite:"), chalk.reset(`(${prevState}, ${x}) |---> ${nextState}`));
    } else {
        /*
         * Regular transition.
         */
        nextState = this.transition(prevState, x)
        // DEBUG
        logger.debug(chalk.reset("transition:"), `(${prevState}, ${x}) |---> ${nextState}`);
    }

    if(nextState.length === 0) {
        /* 
         * Learn and reset parsing. There is no next state to step on. Extend the graph by 
         * a new state over x (and its respective connections)
         */
        let newState = stateSpace.createStateOver(x);
        // let newState = stateSpace.createStateOverInputAndExposeToIgnition(x)
        this.defineTransition(prevState, x, newState);
        nextState = []; 
        /* 
         * Note: 
         *  - backShift = 0 yields nextPos = pos + 1, and
         *  - backShift = 1 yields nextPos = pos 
         */
        nextPos = lastIgnition + Math.max( ((pos + 1) - lastIgnition) - backShift, 0);
        // DEBUG
        logger.debug("create new state:", newState);
        logger.debug("define transition:", `(${prevState}, ${x}) |--> ${newState}` )
        logger.info("Learned phrase:", inputSequence
                                        .slice(lastIgnition, pos + 1)
                                        .join(""));
        logger.debug(chalk.reset(`Continue`), `(with back shift ${backShift}): Move ${nextPos - pos} steps and continue in state ${nextState} `)
    } else {
        /* 
         * Continue parsing.
         */
        this.improveConnections(prevState, nextState);
        nextPos = pos + 1;
        // DEBUG
        logger.debug("improve connections:", `(${prevState}, ${x}) |--> ${nextState}` )
        logger.debug(chalk.reset("Continue (no back shift):"), `Move ${nextPos - pos} steps and continue in state ${nextState} `)
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
}


module.exports = SequenceCoder;








