#!/bin/bash

set -e 

cd "$(dirname "$0")/.."

poetry install --no-interaction --no-root