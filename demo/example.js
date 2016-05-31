

var SequenceCoder = require('../lib/pattern-sequence-coder.js');
// console.log(file);


var alphabet = ['a', 'b', 'c', 'd', 'r']
var trainingSequence = 'abracadabra'.split('').map(x => [x]);

var coder  = new SequenceCoder({
     'alphabet': alphabet,
     'backShift': 0
});


coder.reset();
trainingSequence.forEach(function (L) {
	console.log(coder.learn(L))
})



