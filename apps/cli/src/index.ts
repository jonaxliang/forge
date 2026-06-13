#!/usr/bin/env node

const [, , command = "help"] = process.argv;

if (command === "doctor") {
  console.log("forgecli doctor: ok");
} else {
  console.log("forgecli placeholder");
  console.log("Usage: forgecli doctor");
}
