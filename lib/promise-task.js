'use strict';

var util = require('util');
var sprintf = require('sprintf').sprintf;

var BaseTask = require('./base-task.js');

function format_error(errmsg, obj) {
  return sprintf('%s - %s', errmsg, util.inspect(obj));
}

var REQ = 'promiseTask requires f, a, out';
var FN_REQ = 'promiseTask requires f to be a function or string';
var A_REQ = 'promiseTask requires a to be an array of string param names';
var OUT_REQ = 'promiseTask requires out to be an array[1] of string param names';

function PromiseTask(taskDef) {
  var self = this;
  Object.keys(taskDef).forEach(function (k) { self[k] = taskDef[k]; });
}

PromiseTask.prototype = new BaseTask();
PromiseTask.prototype.constructor = PromiseTask;

PromiseTask.validate = function (taskDef) {
  var errors = [];
  if (!taskDef.f || !taskDef.a || !taskDef.out) {
    errors.push(format_error(REQ, taskDef));
  } else {
    var ftype = typeof(taskDef.f);
    if (! ((taskDef.f instanceof Function) || (ftype === 'string'))) {
      errors.push(format_error(FN_REQ, taskDef));
    }
    if (! (Array.isArray(taskDef.a) &&
           taskDef.a.every(function (x) { return (typeof(x) === 'string'); }))) {
      errors.push(format_error(A_REQ, taskDef));
    }
    if (! (Array.isArray(taskDef.out) && taskDef.out.length <= 1 && 
           taskDef.out.every(function (x) { return (typeof(x) === 'string'); }))) {
      errors.push(format_error(OUT_REQ, taskDef));
    }
  }
  return errors;
};

PromiseTask.prototype.prepare = function prepare(handleTaskError, vCon, contExec) {
  var self = this;
  this.nextFn = function (arg) {
    var args = Array.prototype.slice.call(arguments);
    vCon.saveResults(self.out, args);
    self.complete(args);
    contExec();
  };
  this.failFn = function (err) {
    handleTaskError(self, err);
  };
};

PromiseTask.prototype.exec = function exec(vCon, handleError, contExec) {
  try {
    var args = this.a.map(function (k) { return vCon.getVar(k); }); //get args from vCon
    //console.error('PromiseTask.exec.args=', args);
    //console.error('PromiseTask.exec.vCon=', vCon);
    this.start(args); //note the start time, args
    var func = this.f;
    var bindObj = null; //global space
    if (this.isMethodCall()) { //if method call then reset func and bindObj
      func = vCon.getVar(this.f);
      bindObj = this.getMethodObj(vCon);
    } else if (typeof(func) === 'string') {
      func = vCon.getVar(func); // we want the actual fn from this string
    }
    var retValue = func.apply(bindObj, args);
    if (retValue.then) { // is a promise
      retValue.then(this.nextFn, this.failFn);
    } else { // just a value, proceed now
      this.nextFn(retValue);
    }
  } catch (err) { //catch and handle the task error, calling final cb
    handleError(this, err);
  }    
};

module.exports = PromiseTask;