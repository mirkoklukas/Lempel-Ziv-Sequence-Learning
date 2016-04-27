var fs = require('fs');
var file = fs.readFileSync('./data/calgary/book1', "utf8");
var file += fs.readFileSync('./data/calgary/book2', "utf8");
// console.log(file);


// var alphabet = ['a', 'b', 'c', 'd', 'r']
// var doc = 'abracadabra';
var alphabet = file.split("")
var doc = file;

var inputSequence = doc.split("")
var SequenceCoder = require('../lib/LZ78-sequence-coder.js');

var coder  = new SequenceCoder({
     'alphabet': alphabet,
     'backShift': 1
});

coder.learnSequence(inputSequence);


var viz = require('../lib/state-space-vizualizer.js');


// var cut = viz.cutThroughSpace(coder.stateSpace, inputSequence)
// var cutOnGrid = viz.toGrid(cut)
// console.log(JSON.stringify(cutOnGrid));
