function sendCommand(command)
{
	local.send("/eos/cmd", command+"#");
}

function getCommandTarget(target, id, startID, endID)
{
	var globalStart = local.parameters.startChannel.get();
	if(target == "one") return "Chan "+(globalStart+id);
	if(target == "range") return "Chan "+(globalStart+startID)+" Thru "+(globalStart+endID);
	if(target == "all") return "Group "+globalStart;
}

function getColorMessage(color, showRest)
{
	var r = parseInt(color[0]*100);
	var g = parseInt(color[1]*100);
	var b = parseInt(color[2]*100);
	if(r < 10) r = "0"+r;
	if(g < 10) g = "0"+g;
	if(b < 10) b = "0"+b;

	return "Red @ "+r+" Green @ "+g+" Blue @ "+b+(showRest?" Cyan @ 0 Amber @ 0 Indigo @ 0 White @ 0":"");
}

function valueCallback(target, id, startID, endID, value)
{
	var v = parseInt(value*100);
	if(v < 10) v = "0"+v;
	var cmd = getCommandTarget(target, id, startID, endID)+" @ "+v;
	sendCommand(cmd);
}

function colorCallback(target, id, startID, endID, color)
{
	var cmd = getCommandTarget(target, id, startID, endID);
	var colCmd  = getColorMessage(color);
	sendCommand(cmd+" "+colCmd);
}

function blackOutCallback(target, propID, startID, endID)
{
	var cmd = getCommandTarget(target, id, startID, endID);
	var colCmd  = getColorMessage(color, true);
	sendCommand(cmd+" "+colCmd);

	cmd = getCommandTarget(target, id, startID, endID)+" @ 0";
	sendCommand(cmd);
}

//Advanced functions
function gradientCallback(startID, endID, color1, color2)
{
	if(startID == endID) 
	{
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

	for(var i=minID;i<=maxID;i++)
	{
		var p = (i-minID)*1.0/(maxID-minID);

		var r = (r1+(r2-r1)*p);
		var g = (g1+(g2-g1)*p);
		var b = (b1+(b2-b1)*p);

		var cmd = getCommandTarget("one",i);
		var colorCmd = getColorMessage([r,g,b]);

		sendCommand(cmd+" "+colorCmd);
	} 
}

function pointCallback(startID, endID, position, size, fade, color)
{
	var r = color[0];
	var g = color[1];
	var b = color[2];

	for(var i=startID;i<=endID;i++)
	{
		var p = (i-startID)*1.0/(endID-startID);

		var cmd = getCommandTarget("one",i);
		var colorCmd;
		if(Math.abs(position-p) < size) 
		{
			var fac = Math.min(Math.max(1-Math.abs((p-position)*fade*3/size),0),1);
			colorCmd = getColorMessage([r*fac, g*fac, b*fac]);
		}else
		{
			colorCmd = getColorMessage([0,0,0]);
		}

		sendCommand(cmd+" "+colorCmd);
	}
}

// Functions to read cuelist and cuenumber

function oscEvent(adress, args) 
{
	// Register pattern with Wildcards for cueliste and cuenummer
    local.register("/eos/out/*/cue/*/*", "cueCallback");
	
	// Register pattern with Wildcards for cueText
	local.register("/eos/out/*/cue/text", "cueTextCallback");
	
	
}

function cueCallback(address, args) {
    // Check if adresspattern matches
    if (local.match(address, "/eos/out/*/cue/*/*")) {
        // Splitte in parts
        var addressParts = address.split("/");

        // Die cueliste ist der 6. Teil (Index 5), da es "/eos/out/active/cue/{cueliste}/{cuenummer}" ist
        var cueliste = addressParts[5];

        // Die cuenummer ist der 7. Teil (Index 6)
        var cuenummer = addressParts[6];

        // Ausgabe der empfangenen Werte
        if (addressParts[3] == "active") root.modules.eosOSC.values.activeCueNo.set(cuenummer);
		if (addressParts[3] == "active") root.modules.eosOSC.values.activeCuelistNo.set(cueliste);
		if (addressParts[3] == "pending") root.modules.eosOSC.values.pendingCueNo.set(cuenummer);
		if (addressParts[3] == "pending") root.modules.eosOSC.values.pendingCuelistNo.set(cueliste);
			
		//DEBUG script.log("Pending cue: List " + cueliste + ", Cue " + cuenummer);
	
    }
}

function cueTextCallback(address, args) {
    // Prüfen, ob das Addressmuster übereinstimmt
    if (local.match(address, "/eos/out/*/cue/text")) {
        // Splitte die Adresse in ihre Teile
        var addressParts = address.split("/");
        // Ausgabe der empfangenen Werte
        if (addressParts[3] == "active") root.modules.eosOSC.values.activeCueName.set(args[0]);
		if (addressParts[3] == "pending") root.modules.eosOSC.values.pendingCueName.set(args[0]);

    }
}
