import fetch from "node-fetch";
import fs from "fs";

const commands = JSON.parse(fs.readFileSync("commands.json", "utf-8"));
const { telemetryURL, actionURL, updateInterval } = JSON.parse(
	fs.readFileSync("settings.json", "utf-8")
);

let oldState = {};
let newState = {};

const log = (msg) => {
	let today = new Date();
	let time =
		today.getHours() + ":" + today.getMinutes() + ":" + today.getSeconds();

	console.log(`[${time}] - ${msg}`);
};

const getChangedKeys = (oldState, newState) => {
	// Determine which if any of the values has changed
	const differentKeys = [];

	for (const key of Object.keys(newState)) {
		// Get the value of the key we're comparing
		const value = newState[key];
		// Find the corresponding key in oldState
		const comparisonValue = oldState[key];

		// Check if there is a difference
		const difference = value !== comparisonValue;

		if (difference) {
			differentKeys.push(key);
		}
	}

	return differentKeys;
};

const executeCommands = async (
	executeList,
	commands,
	state,
	isInitialFetch
) => {
	// For every key that changed, find the function corresponding to that value and execute
	// Note: on initial fetch, only execute the corresponding command if executeOnInitialFetch is true

	for (const key of executeList) {
		// Get the present value for the command we've been told to execute
		const value = state[key];

		// Find the appropriate action to take in the commands
		const action = commands[key]?.actions[value];

		// Also figure out whether we're supposed to execute on initial fetch
		let executeOnInitialFetch = commands[key]?.executeOnInitialFetch;

		let shouldExecute = false;
		if (executeOnInitialFetch) {
			shouldExecute = true;
		} else if (!isInitialFetch) {
			shouldExecute = true;
		}

		// Abort and call an error if no command is defined
		if (action === undefined) {
			log(
				`A command for ${key} could not be executed because the ${value} state is not defined in commands.json`
			);
			continue;
		}

		if (shouldExecute) {
			// Make call to appropriate Companion button
			// GET etc
			log(
				`Executing companion button '${action}' because value of ${key} changed to ${value}`
			);
			const response = await fetch(actionURL + action, {
				method: "get",
			});
			log("Fetch response status: " + response.status);
		} else {
			log(
				`Skipping action ${action} triggered from ${key} - not a valid execute circumstance`
			);
		}
	}
};

const fetchLoop = async () => {
	log("Telemetry fetch starting");

	// Do we have an old state?
	let initialFetch = true;
	if (Object.keys(oldState).length > 0) {
		initialFetch = false;
	}

	if (initialFetch) {
		log("This is the first fetch after restart or reboot");
	}

	// GET current state
	// get etc
	const response = await fetch(telemetryURL);
	const data = await response.json();
	console.log(data);
	newState = data;

	let executeList = [];

	// Compare old and new
	if (initialFetch) {
		executeList = Object.keys(newState);
	} else {
		executeList = getChangedKeys(oldState, newState);
	}

	// Execute the commands we filtered out
	executeCommands(executeList, commands, newState, initialFetch);

	// Set newState to oldState
	oldState = newState;
};

// Start updating at set interval
setInterval(fetchLoop, updateInterval);
