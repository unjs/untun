#!/usr/bin/env node

import jiti from "jiti";

const { runMain } = jiti(import.meta.url)("../src/cli");

runMain();
