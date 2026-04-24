/**
 * Sends and terminates a command to Eos.
 *
 * @param {string} command The command to send.
 */
function sendCommand(command) {
	local.send("/eos/cmd", command+"#");
}

/**
 * Create an Eos message to specify the input target
 *
 * @param target {string} Target type: "one" "all" "range"
 * @param [id] {int} Target "one" id
 * @param [startID] {int} Target "range" start id
 * @param [endID] {int} Target "range" end id
 *
 * @returns {string} Eos channel selection command
 */
function getCommandTarget(target, id, startID, endID) {
	var globalStart = local.parameters.startChannel.get();
	if (target == "one") return "Chan "+(globalStart+id);
	if (target == "range") return "Chan "+(globalStart+startID)+" Thru "+(globalStart+endID);
	if (target == "all") return "Select_All";
}

/**
 * Create an Eos message to set channel color from color input
 *
 * @param color {[red: number, green: number, blue: number]} Color array (values 0.0-1.0)
 *
 * @returns {string} Eos color command
 */
function getColorMessage(color) {
	var r = Math.round(color[0] * 100);
	var g = Math.round(color[1] * 100);
	var b = Math.round(color[2] * 100);
	r = normalizeEosSingleDigit(r);
	g = normalizeEosSingleDigit(g);
	b = normalizeEosSingleDigit(b);

	return "Red "+r+" Green "+g+" Blue "+b;
}

/**
 * Send command to set target to value
 *
 * @param target {string} Target type: "one" "all" "range"
 * @param id {int} Target "one" id
 * @param startID {int} Target "range" start id
 * @param endID {int} Target "range" end id
 * @param value {number} Value 0.0-1.0
 */
function valueCallback(target, id, startID, endID, value) {
	var v = Math.round(value * 100);
	v = normalizeEosSingleDigit(v);

	var cmd = getCommandTarget(target, id, startID, endID)+" @ "+v;
	sendCommand(cmd);
}

/**
 * Send command to set target to color
 *
 * @param target {string} Target type: "one" "all" "range"
 * @param id {int} Target "one" id
 * @param startID {int} Target "range" start id
 * @param endID {int} Target "range" end id
 * @param color {[red: number, green: number, blue: number]} Color array (values 0.0-1.0)
 */
function colorCallback(target, id, startID, endID, color) {
	var cmd = getCommandTarget(target, id, startID, endID);
	var colCmd  = getColorMessage(color);
	sendCommand(cmd+" "+colCmd);
}

/**
 * Send command to set target value and color to 0
 *
 * @param target {string} Target type: "one" "all" "range"
 * @param id {int} Target "one" id
 * @param startID {int} Target "range" start id
 * @param endID {int} Target "range" end id
 */
function blackOutCallback(target, id, startID, endID) {
	var cmd = getCommandTarget(target, id, startID, endID);
	sendCommand(cmd+" Color 0");

	cmd = getCommandTarget(target, id, startID, endID)+" @ Out";
	sendCommand(cmd);
}

// Advanced functions
/**
 * Send command to set target range to color gradient
 *
 * @param startID {int} Target range start id
 * @param endID {int} Target range start id
 * @param color1 {[red: number, green: number, blue: number]} Gradient start color array (values 0.0-1.0)
 * @param color2 {[red: number, green: number, blue: number]} Gradient end color array (values 0.0-1.0)
 */
function gradientCallback(startID, endID, color1, color2) {
	if (startID == endID) {
		colorCallback("one",startID,0,0,color1);
		return;
	}
	var r1 = color1[0];
	var g1 = color1[1];
	var b1 = color1[2];

	var r2 = color2[0];
	var g2 = color2[1];
	var b2 = color2[2];

	var minID = Math.min(startID, endID);
	var maxID = Math.max(startID, endID);

	for (var i = minID; i <= maxID; i++) {
		var p = parseFloat(i-minID) / (maxID-minID); //Percent of all targets

		var r = (r1+(r2-r1)*p);
		var g = (g1+(g2-g1)*p);
		var b = (b1+(b2-b1)*p);

		colorCallback("one", i, undefined, undefined, [r,g,b]);
	}
}

/**
 * Send command to set target range to a pointed gradient
 *
 * @param startID {int} Target range start id
 * @param endID {int} Target range start id
 * @param position {number} Where the point should be centered (0.0-1.0)
 * @param size {number} The size of the point in either direction (0.0-1.0)
 * @param fade {number} Amount to fade target to target (0.0-1.0)
 * @param color {[red: number, green: number, blue: number]} Color array (values 0.0-1.0)
 */
function pointCallback(startID, endID, position, size, fade, color) {
	var r = color[0];
	var g = color[1];
	var b = color[2];

	for (var i = startID; i <= endID; i++) {
		var p = parseFloat(i-startID) / (endID-startID); //Percent of all targets

		if (Math.abs(position-p) < size) { //If distance from center position is less than size
			var fac = (position-p) * fade * 3;
			fac = 1 - Math.abs(fac / size);
			fac = Math.min(Math.max(fac,0),1);

			colorCallback("one", i, undefined, undefined, [r*fac, g*fac, b*fac]);
		} else {
			colorCallback("one", i, undefined, undefined, [0, 0, 0]);
		}
	}
}

// Functions to read cuelist and cue number
/**
 * Register OSC patterns for callback recognition
 *
 * @param address {string} OSC address
 * @param args {string} OSC arguments
 */
function oscEvent(address, args) {
	// Register pattern with Wildcards for cuelist and cue number
	local.register("/eos/out/*/cue/*/*", "cueCallback");
	local.register("/eos/out/*/cue", "cueCallback");

	// Register pattern with Wildcards for cueText
	local.register("/eos/out/*/cue/text", "cueTextCallback");
}

/**
 * Parse Eos active/pending cue number output and set module values
 *
 * @param address {string} OSC address
 * @param args {string} OSC arguments
 */
function cueCallback(address, args) {
	// Check if address pattern matches cue numbers
	if (local.match(address, "/eos/out/*/cue/*/*") || local.match(address, "/eos/out/*/cue")) {
		// Split in parts
		var addressParts = address.split("/");

		// The type is part 4 (index 3) for output "/eos/out/<active-pending>/cue/<list>/<cue>"
		var cueType = addressParts[3];

		var cuelist = 0;
		var cueNumber = 0.0;

		// Check if address pattern matches cue numbers
		if (local.match(address, "/eos/out/*/cue/*/*")) {
			// The cuelist is part 6 (index 5) for output "/eos/out/<active-pending>/cue/<list>/<cue>"
			cuelist = parseInt(addressParts[5]);

			// The cue number is part 7 (index 6) for output "/eos/out/<active-pending>/cue/<list>/<cue>"
			cueNumber = parseFloat(addressParts[6]);

			// Output the received values
			if (cueType == "active") {
				local.values.activeCueNo.set(cueNumber);
				local.values.activeCuelistNo.set(cuelist);
			} else if (cueType == "pending") {
				local.values.pendingCueNo.set(cueNumber);
				local.values.pendingCuelistNo.set(cuelist);
			}
		}

		// DEBUG
		script.log(cueType.charAt(0).toUpperCase() + cueType.substring(1) + " cue: List " + cuelist + ", Cue " + cueNumber);
	}
}

/**
 * Parse Eos active/pending cue text output and set module values
 *
 * @param address {string} OSC address
 * @param args {string} OSC arguments
 */
function cueTextCallback(address, args) {
	// Check if address pattern matches
	if (local.match(address, "/eos/out/*/cue/text")) {
		// Split in parts
		var addressParts = address.split("/");

		// The type is part 4 (index 3) for output "/eos/out/<active-pending>/cue/<list>/<cue>"
		var cueType = addressParts[3];

		// Output the received values
		if (cueType == "active") local.values.activeCueName.set(args[0]);
		if (cueType == "pending") local.values.pendingCueName.set(args[0]);
	}
}

// Utilities
/**
 * Add leading 0 to single digit numbers
 *
 * @param value {number} The number to normalize
 *
 * @returns {string} The normalized number
 */
function normalizeEosSingleDigit(value) {
	if (value > 0 && value < 10) {
		return "0" + value;
	}
	return value;
}
