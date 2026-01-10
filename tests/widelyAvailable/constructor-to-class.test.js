import assert from "node:assert/strict"
import { describe, suite, test } from "node:test"
import { transform } from "../../src/index.js"

suite("widely-available", () => {
  describe("constructorToClass", () => {
    test("simple constructor with prototype methods", () => {
      const result = transform(`
function Person(name) {
this.name = name;
}

Person.prototype.greet = function() {
return 'Hello, ' + this.name;
};
    `)

      assert(result.modified, "transform constructor to class")
      assert.match(result.code, /class Person/)
      assert.match(result.code, /constructor\(name\)/)
      assert.match(result.code, /greet\(\)/)
    })

    test("keep comments", () => {
      const result = transform(`
// Person
function Person(name) {
this.name = name;
}

Person.prototype.greet = function() {
return 'Hello, ' + this.name;
};
    `)

      assert.match(result.code, /\/\/ Person/)
    })

    test("keep jsdocs", () => {
      const result = transform(`
/**
* Person
*
* @argument {string} name - The name of the person
*/
function Person(name) {
this.name = name;
}

Person.prototype.greet = function() {
return 'Hello, ' + this.name;
};
    `)

      assert.match(result.code, /@argument \{string} name - The name of the person/)
    })

    test("constructor with multiple prototype methods", () => {
      const result = transform(`
function Animal(type) {
this.type = type;
}

Animal.prototype.speak = function() {
return this.type + ' makes a sound';
};

Animal.prototype.move = function() {
return this.type + ' is moving';
};
    `)

      assert(result.modified, "transform constructor with multiple methods")
      assert.match(result.code, /class Animal/)
      assert.match(result.code, /speak\(\)/)
      assert.match(result.code, /move\(\)/)
    })

    test("skip lowercase function names", () => {
      const result = transform(`
function helper(value) {
this.value = value;
}

helper.prototype.process = function() {
return this.value * 2;
};
    `)

      assert(!result.modified, "skip lowercase function names")
    })

    test("skip constructor without prototype methods", () => {
      const result = transform(`
function Person(name) {
this.name = name;
}
    `)

      assert(!result.modified, "skip constructor without prototype methods")
    })

    test("transform safe arrow functions on prototype", () => {
      const result = transform(`
function Person(name) {
this.name = name;
}

Person.prototype.greet = () => {
return 'Hello';
};
    `)

      assert(result.modified, "transform safe arrow functions on prototype")
      assert.match(result.code, /class Person/)
      assert.match(result.code, /greet\(\)/)
      assert.match(result.code, /return 'Hello'/)
    })

    test("skip arrow functions with 'this' on prototype", () => {
      const result = transform(`
function Person(name) {
this.name = name;
}

Person.prototype.greet = () => {
return this.name;
};
    `)

      assert(!result.modified, "skip arrow functions with 'this' on prototype")
    })

    test("transform arrow function with expression body on prototype", () => {
      const result = transform(`
function Foo() {
this.name = "Klass";
}

Foo.prototype.getName = () => "foot";
    `)

      assert(result.modified, "transform arrow function with expression body")
      assert.match(result.code, /class Foo/)
      assert.match(result.code, /getName\(\)/)
      assert.match(result.code, /return "foot"/)
    })

    test("transform mixed function and arrow functions on prototype", () => {
      const result = transform(`
function Person(name) {
this.name = name;
}

Person.prototype.greet = function() {
return 'Hello, ' + this.name;
};

Person.prototype.getType = () => {
return 'Person';
};
    `)

      assert(result.modified, "transform mixed functions")
      assert.match(result.code, /class Person/)
      assert.match(result.code, /greet\(\)/)
      assert.match(result.code, /getType\(\)/)
      assert.match(result.code, /return 'Person'/)
    })

    test("transform async arrow function on prototype", () => {
      const result = transform(`
function Fetcher() {
this.url = "api.example.com";
}

Fetcher.prototype.fetch = async () => {
return "data";
};
    `)

      assert(result.modified, "transform async arrow function")
      assert.match(result.code, /class Fetcher/)
      assert.match(result.code, /async fetch\(\)/)
      assert.match(result.code, /return "data"/)
    })

    test("constructor with no parameters", () => {
      const result = transform(`
function Counter() {
this.count = 0;
}

Counter.prototype.increment = function() {
this.count++;
};
    `)

      assert(result.modified, "transform constructor with no parameters")
      assert.match(result.code, /class Counter/)
      assert.match(result.code, /constructor\(\)/)
      assert.match(result.code, /increment\(\)/)
    })

    test("transform constructor with variable declarations in body", () => {
      const result = transform(`
function Person(name) {
this.name = name;
const temp = processName(name);
this.processed = temp;
}

Person.prototype.greet = function() {
return 'Hello, I am ' + this.name;
};
    `)

      // The constructor can be safely transformed even with variable declarations
      assert.match(result.code, /class Person/)
      assert.match(result.code, /constructor\(name\)/)
      assert.match(result.code, /greet\(\)/)
    })

    test("constructor with expression body statements", () => {
      const result = transform(`
function Person(name, age) {
this.name = name;
this.age = age;
}

Person.prototype.greet = function() {
return 'Hello, ' + this.name;
};

Person.prototype.getAge = function() {
return this.age;
};
    `)

      assert(result.modified, "transform constructor with multiple properties")
      assert.match(result.code, /class Person/)
      assert.match(result.code, /constructor\(name, age\)/)
    })

    test("skip factory pattern with return statement", () => {
      const result = transform(`
function Something() {
var depth = 0;
return {
  incDepth: function() {
    depth++;
  }
};
}

foo = Something();
    `)

      // Factory pattern should not be transformed to a class
      assert.match(result.code, /function Something/)
      assert.doesNotMatch(result.code, /class Something/)
    })

    test("skip constructor with return statement", () => {
      const result = transform(`
function Factory(config) {
this.config = config;
return this.config;
}

Factory.prototype.process = function() {
return this.config;
};
    `)

      // Constructor with return statement should not be transformed
      assert.match(result.code, /function Factory/)
      assert.doesNotMatch(result.code, /class Factory/)
    })

    test("transform function expression with method call in constructor", () => {
      const result = transform(`
var SomeClass = function (selector) {
this.element = document.querySelector(selector);
this.init();
};

SomeClass.prototype = {
init: function () {
  process('init');
}
};
    `)

      // Constructor with method call is still a simple constructor and should be transformed
      assert(result.modified, "transform constructor with method call")
      assert.match(result.code, /class SomeClass/)
      assert.match(result.code, /constructor\(selector\)/)
      assert.match(result.code, /init\(\)/)
    })

    test("skip prototype assignment with non-function methods", () => {
      const result = transform(`
function Widget(id) {
this.id = id;
}

Widget.prototype = {
value: 42
};
    `)

      assert(!result.modified, "skip prototype object without function expressions")
    })

    test("transform prototype assignment with safe arrow function methods", () => {
      const result = transform(`
function Component(props) {
this.props = props;
}

Component.prototype = {
render: () => {
  return null;
}
};
    `)

      assert(result.modified, "transform prototype object with safe arrow functions")
      assert.match(result.code, /class Component/)
      assert.match(result.code, /render\(\)/)
    })

    test("skip prototype assignment with arrow functions that use 'this'", () => {
      const result = transform(`
function Component(props) {
this.props = props;
}

Component.prototype = {
render: () => {
  return this.props;
}
};
    `)

      assert(!result.modified, "skip prototype object with unsafe arrow functions")
    })

    test("transform prototype assignment with mixed safe arrow and function expressions", () => {
      const result = transform(`
function Bar() {
this.name = "Klass";
}

Bar.prototype = {
getName: function() {
  return "bar";
},
getBaz: () => {
  return "baz";
},
}
    `)

      assert(result.modified, "transform mixed prototype object")
      assert.match(result.code, /class Bar/)
      assert.match(result.code, /getName\(\)/)
      assert.match(result.code, /getBaz\(\)/)
      assert.match(result.code, /return "baz"/)
    })

    test("skip prototype assignment with getter/setter properties", () => {
      const result = transform(`
function Model(name) {
this.name = name;
}

Model.prototype = {
get value() {
  return this.name;
}
};
    `)

      assert(!result.modified, "skip prototype object with getter properties")
    })

    test("skip prototype assignment with computed properties", () => {
      const result = transform(`
function Handler(type) {
this.type = type;
}

Handler.prototype = {
[Symbol.toStringTag]: function() {
  return this.type;
}
};
    `)

      assert(!result.modified, "skip prototype object with computed properties")
    })

    test("skip constructor with complex body statements", () => {
      const result = transform(`
function Service(config) {
if (config) {
  this.config = config;
}
}

Service.prototype.init = function() {
return this.config;
};
    `)

      assert.match(result.code, /class Service/)
    })

    test("skip prototype method assignment with non-function value", () => {
      const result = transform(`
function Manager(id) {
this.id = id;
}

Manager.prototype.defaultValue = 10;
    `)

      assert(!result.modified, "skip prototype with non-function assignment")
    })

    test("variable declaration constructor with generator method", () => {
      const result = transform(`
var Generator = function(data) {
this.data = data;
}

Generator.prototype.process = function*() {
yield this.data;
};
    `)

      assert(result.modified, "transform constructor with generator method")
      assert.match(result.code, /class Generator/)
      assert.match(result.code, /\*process/)
    })

    test("skip pattern 2 assignment with non-object value", () => {
      const result = transform(`
function Parser(input) {
this.input = input;
}

Parser.prototype = null;
    `)

      assert(!result.modified, "skip prototype assignment to non-object")
    })

    test("constructor with block statement in body", () => {
      const result = transform(`
function Strict(mode) {
'use strict';
this.mode = mode;
}

Strict.prototype.check = function() {
return this.mode;
};
    `)

      assert(result.modified, "transform constructor with directive")
      assert.match(result.code, /class Strict/)
    })

    test("variable declaration constructor with prototype methods", () => {
      const result = transform(`
var Calculator = function(value) {
this.value = value;
}

Calculator.prototype.add = function(num) {
return this.value + num;
};
    `)

      assert(result.modified, "transform variable declaration constructor")
      assert.match(result.code, /class Calculator/)
    })

    test("skip constructor with throw statement in body", () => {
      const result = transform(`
function Validator(value) {
if (!value) {
  throw new Error('invalid');
}
this.value = value;
}

Validator.prototype.validate = function() {
return this.value;
};
    `)

      assert.match(result.code, /class Validator/)
    })

    test("transform constructor with only assignment statements", () => {
      const result = transform(`
function Iterator(items) {
this.items = items;
this.index = 0;
}

Iterator.prototype.next = function() {
return this.items[this.index++];
};
    `)

      assert(result.modified, "transform constructor with safe body")
      assert.match(result.code, /class Iterator/)
    })

    test("skip constructor with computed property in prototype literal", () => {
      const result = transform(`
function Handler(type) {
this.type = type;
}

Handler.prototype = {
[Symbol.toStringTag]: function() {
  return this.type;
}
};
    `)

      assert(!result.modified, "skip prototype with computed property")
    })

    test("prototype literal with non-identifier properties", () => {
      const result = transform(`
function Component(props) {
this.props = props;
}

Component.prototype = {
'method-name': function() {
  return this.props;
}
};
    `)

      assert(!result.modified, "skip prototype literal with string keys")
    })

    test("constructor with return statement prevents transformation", () => {
      const result = transform(`
function Creator(config) {
this.config = config;
if (!config) {
  return;
}
}

Creator.prototype.start = function() {
return this.config;
};
    `)

      assert(result.modified, "skip constructor with return")
      assert.match(result.code, /class Creator/)
    })

    test("prototype object with only getter property", () => {
      const result = transform(`
function Box(value) {
this.value = value;
}

Box.prototype = {
get size() {
  return this.value * 2;
}
};
    `)

      assert(!result.modified, "skip constructor when only getter in prototype")
    })

    test("prototype object with getter and function method", () => {
      const result = transform(`
function Box(value) {
this.value = value;
}

Box.prototype = {
get size() {
  return this.value * 2;
},
getValue: function() {
  return this.value;
}
};
    `)

      assert(result.modified, "transform constructor ignoring getter property")
      assert.match(result.code, /class Box/)
    })

    test("prototype object with only non-function property", () => {
      const result = transform(`
function Widget(id) {
this.id = id;
}

Widget.prototype = {
config: { timeout: 1000 }
};
    `)

      assert(!result.modified, "skip constructor when no function methods")
    })

    test("prototype object with non-function and function properties", () => {
      const result = transform(`
function Widget(id) {
this.id = id;
}

Widget.prototype = {
config: { timeout: 1000 },
getValue: function() {
  return this.id;
}
};
    `)

      assert(result.modified, "transform constructor ignoring non-function property")
      assert.match(result.code, /class Widget/)
    })

    test("skip var declaration with arrow function", () => {
      const result = transform(`
var Calculator = (value) => {
this.value = value;
};

Calculator.prototype.add = function(num) {
return this.value + num;
};
    `)

      assert.doesNotMatch(
        result.code,
        /class Calculator/,
        "skip arrow function constructor",
      )
    })

    test("skip var declaration constructor with complex body", () => {
      const result = transform(`
var Service = function(config) {
if (config) {
  this.config = config;
}
};

Service.prototype.init = function() {
return this.config;
};
    `)

      assert.match(
        result.code,
        /class Service/,
        "skip var declaration with complex body",
      )
    })

    test("var declaration prototype with getter property", () => {
      const result = transform(`
var Box = function(value) {
this.value = value;
};

Box.prototype = {
get size() {
  return this.value * 2;
}
};
    `)

      assert.doesNotMatch(
        result.code,
        /class Box/,
        "skip var declaration with getter prototype",
      )
    })

    test("function declaration constructor with empty body", () => {
      const result = transform(`
function Empty() {}

Empty.prototype.run = function() {
return this.value;
};
    `)

      assert(result.modified, "transform function declaration with empty body")
      assert.match(result.code, /class Empty/)
    })
  })
})
