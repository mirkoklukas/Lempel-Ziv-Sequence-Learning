var logger = require('winston');
logger.level = 'debug';

/*
 *
 */
var idGen = (function () {
	var id = 0;
	return function () {
		return id++;
	};
})();

const EMPTY_STATE = Symbol("Empty State"); 
/*
 *
 */
var StateSpace = function (config) {
	this.connections = {}
	this.connections[EMPTY_STATE] = {}
	this.fibre = {}
	this.base = {}
	this.alphabet = config.alphabet
	this.initialWeight = config.initialWeight || 1;
	this.predictionThreshold = config.predictionThreshold || 1;
	for(var x of config.alphabet) { 
		this.fibre[x] = new Set(); }


};

StateSpace.prototype.getBase = function (stateId) {
	return this.base[stateId];
};

StateSpace.prototype.getFibre = function (x) {
	return Array.from(this.fibre[x]);
};

StateSpace.prototype.addState = function (base, stateId) {
	this.fibre[base].add(stateId);
	this.base[stateId] = base;
	this.connections[stateId] = {};
	return this;
};

StateSpace.prototype.push = StateSpace.prototype.addState;


StateSpace.prototype.addConnection = function (i, j) {
	this.connections[i][j] = this.initialWeight;	
	return this;
};

StateSpace.prototype.addConnections = function (sources, targets) {
	'use strict';
	var sources = (sources.length === 0) ? [EMPTY_STATE] : sources;
	for (let i of sources) {
		for (let j of targets) { 
			this.addConnection(i,j); }}
	return this;
};

StateSpace.prototype.createStateOver = function (x) {
	var id = idGen();
	this.push(x, id);
	return [id];
}

StateSpace.prototype.getWeight = function (i,j) {
	var w = this.connections[i][j]
	return w === undefined ? -1 : w;
};

StateSpace.prototype.setWeight = function (i,j, w) {
	// We assume that i has already been added,
	// and a connection dict at i should be present
	this.connections[i][j] = w;
	return this;
};

StateSpace.prototype.addDeltaToWeight = function (i,j, delta) {
	// We assume that i has already been added,
	// and a connection dict at i should be present
	if(j in this.connections[i]) { 
		this.connections[i][j] += delta; }
	else { 
		this.connections[i][j]  = delta; } 

	return this;
};

StateSpace.prototype.getStableSuccessors = function (listOfStates) {
	'use strict';
	var sources = (listOfStates.length == 0) ? [EMPTY_STATE] : listOfStates;
	var successors = [];

	for (let s of sources) {
		for (let t of Object.keys(this.connections[s] || {})) {
			let w = this.connections[s][t];
			if(w >= this.predictionThreshold) { 
				successors.push(t); }} }
	return successors
};


/*
 *
 */
module.exports = StateSpace
