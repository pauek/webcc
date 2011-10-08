#!/bin/bash
pegjs c++.pegjs c++.js
cat preamble.js c++.js > c++-parser.js