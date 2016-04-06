require( 'console-group' ).install();
var StateSpace = require('./simple-state-space');
var logger = require('winston');
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
	this.currentState = [];
	this.lastIgnition= null;
	this.lastInput = null;
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
			.filter(id => stateSpace.getBase(id) === x); 
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


SequenceCoder.prototype.learn = function (inputSequence, lastIgnition, prevState, pos) {
	var x         = inputSequence[pos];
	var nextState = this.transition(prevState, x);
	var nextPos;
	var lastIgnition = lastIgnition;
	var backShift    = this.backShift;
	var stateSpace   = this.stateSpace

	if(prevState.length === 0) {
		// Ignition: Step onto the state graph.
		lastIgnition = pos;
	}


	if(nextState.length === 0) {
		// Reached the end of the paths in the state graph.
		// Extend it by a state over the current input.
		logger.info("Learned phrase:", inputSequence
										.slice(lastIgnition, pos + 1)
										.join(""));

		this.defineTransition(prevState, x, stateSpace.createStateOver(x));
		nextState = []; 
		nextPos = lastIgnition + Math.max( ((pos + 1) - lastIgnition) - backShift, 0);
	} else {
		// Continue parsing.
		nextPos = pos + 1;
	}

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








