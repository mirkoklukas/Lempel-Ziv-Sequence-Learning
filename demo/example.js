
var alphabet = ['a', 'b', 'c', 'd', 'r']

var doc = 'abracadabra';
var inputSequence = doc.split("")
var SequenceCoder = require('../lib/LZ78-sequence-coder.js');

var coder  = new SequenceCoder({
     'alphabet': alphabet,
     'backShift': 1
});

coder.learnSequence(inputSequence);