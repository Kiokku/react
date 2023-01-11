/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @noflow
 * @nolint
 * @preventMunge
 * @preserve-invariant-messages
 */

"use strict";
var ReactFlightDOMRelayClientIntegration = require("ReactFlightDOMRelayClientIntegration");
function formatProdErrorMessage(code) {
  for (
    var url = "https://reactjs.org/docs/error-decoder.html?invariant=" + code,
      i = 1;
    i < arguments.length;
    i++
  )
    url += "&args[]=" + encodeURIComponent(arguments[i]);
  return (
    "Minified React error #" +
    code +
    "; visit " +
    url +
    " for the full message or use the non-minified dev environment for full errors and additional helpful warnings."
  );
}
var isArrayImpl = Array.isArray;
function parseModelRecursively(response, parentObj, key, value) {
  if ("string" === typeof value)
    return parseModelString(response, parentObj, key, value);
  if ("object" === typeof value && null !== value) {
    if (isArrayImpl(value)) {
      var parsedValue = [];
      for (parentObj = 0; parentObj < value.length; parentObj++)
        parsedValue[parentObj] = parseModelRecursively(
          response,
          value,
          "" + parentObj,
          value[parentObj]
        );
      response =
        parsedValue[0] === REACT_ELEMENT_TYPE
          ? {
              $$typeof: REACT_ELEMENT_TYPE,
              type: parsedValue[1],
              key: parsedValue[2],
              ref: null,
              props: parsedValue[3],
              _owner: null
            }
          : parsedValue;
      return response;
    }
    parentObj = {};
    for (parsedValue in value)
      parentObj[parsedValue] = parseModelRecursively(
        response,
        value,
        parsedValue,
        value[parsedValue]
      );
    return parentObj;
  }
  return value;
}
var dummy = {},
  REACT_ELEMENT_TYPE = Symbol.for("react.element"),
  REACT_LAZY_TYPE = Symbol.for("react.lazy");
function Chunk(status, value, reason, response) {
  this.status = status;
  this.value = value;
  this.reason = reason;
  this._response = response;
}
Chunk.prototype = Object.create(Promise.prototype);
Chunk.prototype.then = function(resolve, reject) {
  switch (this.status) {
    case "resolved_model":
      initializeModelChunk(this);
      break;
    case "resolved_module":
      initializeModuleChunk(this);
  }
  switch (this.status) {
    case "fulfilled":
      resolve(this.value);
      break;
    case "pending":
    case "blocked":
      resolve &&
        (null === this.value && (this.value = []), this.value.push(resolve));
      reject &&
        (null === this.reason && (this.reason = []), this.reason.push(reject));
      break;
    default:
      reject(this.reason);
  }
};
function readChunk(chunk) {
  switch (chunk.status) {
    case "resolved_model":
      initializeModelChunk(chunk);
      break;
    case "resolved_module":
      initializeModuleChunk(chunk);
  }
  switch (chunk.status) {
    case "fulfilled":
      return chunk.value;
    case "pending":
    case "blocked":
      throw chunk;
    default:
      throw chunk.reason;
  }
}
function createInitializedChunk(response, value) {
  return new Chunk("fulfilled", value, null, response);
}
function wakeChunk(listeners, value) {
  for (var i = 0; i < listeners.length; i++) (0, listeners[i])(value);
}
function wakeChunkIfInitialized(chunk, resolveListeners, rejectListeners) {
  switch (chunk.status) {
    case "fulfilled":
      wakeChunk(resolveListeners, chunk.value);
      break;
    case "pending":
    case "blocked":
      chunk.value = resolveListeners;
      chunk.reason = rejectListeners;
      break;
    case "rejected":
      rejectListeners && wakeChunk(rejectListeners, chunk.reason);
  }
}
function triggerErrorOnChunk(chunk, error) {
  if ("pending" === chunk.status || "blocked" === chunk.status) {
    var listeners = chunk.reason;
    chunk.status = "rejected";
    chunk.reason = error;
    null !== listeners && wakeChunk(listeners, error);
  }
}
function resolveModuleChunk(chunk, value) {
  if ("pending" === chunk.status || "blocked" === chunk.status) {
    var resolveListeners = chunk.value,
      rejectListeners = chunk.reason;
    chunk.status = "resolved_module";
    chunk.value = value;
    null !== resolveListeners &&
      (initializeModuleChunk(chunk),
      wakeChunkIfInitialized(chunk, resolveListeners, rejectListeners));
  }
}
var initializingChunk = null,
  initializingChunkBlockedModel = null;
function initializeModelChunk(chunk) {
  var prevChunk = initializingChunk,
    prevBlocked = initializingChunkBlockedModel;
  initializingChunk = chunk;
  initializingChunkBlockedModel = null;
  try {
    var value = parseModelRecursively(chunk._response, dummy, "", chunk.value);
    null !== initializingChunkBlockedModel &&
    0 < initializingChunkBlockedModel.deps
      ? ((initializingChunkBlockedModel.value = value),
        (chunk.status = "blocked"),
        (chunk.value = null),
        (chunk.reason = null))
      : ((chunk.status = "fulfilled"), (chunk.value = value));
  } catch (error) {
    (chunk.status = "rejected"), (chunk.reason = error);
  } finally {
    (initializingChunk = prevChunk),
      (initializingChunkBlockedModel = prevBlocked);
  }
}
function initializeModuleChunk(chunk) {
  try {
    var value = ReactFlightDOMRelayClientIntegration.requireModule(chunk.value);
    chunk.status = "fulfilled";
    chunk.value = value;
  } catch (error) {
    (chunk.status = "rejected"), (chunk.reason = error);
  }
}
function reportGlobalError(response, error) {
  response._chunks.forEach(function(chunk) {
    "pending" === chunk.status && triggerErrorOnChunk(chunk, error);
  });
}
function getChunk(response, id) {
  var chunks = response._chunks,
    chunk = chunks.get(id);
  chunk ||
    ((chunk = new Chunk("pending", null, null, response)),
    chunks.set(id, chunk));
  return chunk;
}
function createModelResolver(chunk, parentObject, key) {
  if (initializingChunkBlockedModel) {
    var blocked = initializingChunkBlockedModel;
    blocked.deps++;
  } else blocked = initializingChunkBlockedModel = { deps: 1, value: null };
  return function(value) {
    parentObject[key] = value;
    blocked.deps--;
    0 === blocked.deps &&
      "blocked" === chunk.status &&
      ((value = chunk.value),
      (chunk.status = "fulfilled"),
      (chunk.value = blocked.value),
      null !== value && wakeChunk(value, blocked.value));
  };
}
function createModelReject(chunk) {
  return function(error) {
    return triggerErrorOnChunk(chunk, error);
  };
}
function parseModelString(response, parentObject, key, value) {
  switch (value[0]) {
    case "$":
      if ("$" === value) return REACT_ELEMENT_TYPE;
      if ("$" === value[1] || "@" === value[1]) return value.substring(1);
      value = parseInt(value.substring(1), 16);
      response = getChunk(response, value);
      switch (response.status) {
        case "resolved_model":
          initializeModelChunk(response);
          break;
        case "resolved_module":
          initializeModuleChunk(response);
      }
      switch (response.status) {
        case "fulfilled":
          return response.value;
        case "pending":
        case "blocked":
          return (
            (value = initializingChunk),
            response.then(
              createModelResolver(value, parentObject, key),
              createModelReject(value)
            ),
            null
          );
        default:
          throw response.reason;
      }
    case "@":
      return (
        (parentObject = parseInt(value.substring(1), 16)),
        (parentObject = getChunk(response, parentObject)),
        { $$typeof: REACT_LAZY_TYPE, _payload: parentObject, _init: readChunk }
      );
  }
  return value;
}
function resolveModule(response, id, model) {
  var chunks = response._chunks,
    chunk = chunks.get(id);
  model = parseModelRecursively(response, dummy, "", model);
  var moduleReference = ReactFlightDOMRelayClientIntegration.resolveModuleReference(
    model
  );
  if (
    (model = ReactFlightDOMRelayClientIntegration.preloadModule(
      moduleReference
    ))
  ) {
    if (chunk) {
      var blockedChunk = chunk;
      blockedChunk.status = "blocked";
    } else
      (blockedChunk = new Chunk("blocked", null, null, response)),
        chunks.set(id, blockedChunk);
    model.then(
      function() {
        return resolveModuleChunk(blockedChunk, moduleReference);
      },
      function(error) {
        return triggerErrorOnChunk(blockedChunk, error);
      }
    );
  } else
    chunk
      ? resolveModuleChunk(chunk, moduleReference)
      : chunks.set(
          id,
          new Chunk("resolved_module", moduleReference, null, response)
        );
}
exports.close = function(response) {
  reportGlobalError(response, Error(formatProdErrorMessage(412)));
};
exports.createResponse = function(bundlerConfig) {
  var chunks = new Map();
  return { _bundlerConfig: bundlerConfig, _chunks: chunks };
};
exports.getRoot = function(response) {
  return getChunk(response, 0);
};
exports.resolveRow = function(response, chunk) {
  if ("J" === chunk[0]) {
    var id = chunk[1],
      model = chunk[2],
      chunks = response._chunks;
    (chunk = chunks.get(id))
      ? "pending" === chunk.status &&
        ((response = chunk.value),
        (id = chunk.reason),
        (chunk.status = "resolved_model"),
        (chunk.value = model),
        null !== response &&
          (initializeModelChunk(chunk),
          wakeChunkIfInitialized(chunk, response, id)))
      : chunks.set(id, new Chunk("resolved_model", model, null, response));
  } else
    "M" === chunk[0]
      ? resolveModule(response, chunk[1], chunk[2])
      : "S" === chunk[0]
      ? response._chunks.set(
          chunk[1],
          createInitializedChunk(response, Symbol.for(chunk[2]))
        )
      : ((model = chunk[1]),
        (id = chunk[2].digest),
        (chunk = Error(formatProdErrorMessage(441))),
        (chunk.stack = "Error: " + chunk.message),
        (chunk.digest = id),
        (id = response._chunks),
        (chunks = id.get(model))
          ? triggerErrorOnChunk(chunks, chunk)
          : id.set(model, new Chunk("rejected", null, chunk, response)));
};