/* to reload chat commands:

>> for (var i in require.cache) delete require.cache[i];parseCommand = require('./chat-commands.js').parseCommand;''

*/

/**
 * `parseCommand`. This is the function most of you are interested in,
 * apparently.
 *
 * `message` is exactly what the user typed in.
 * If the user typed in a command, `cmd` and `target` are the command (with "/"
 * omitted) and command target. Otherwise, they're both the empty string.
 *
 * For instance, say a user types in "/foo":
 * cmd === "/foo", target === "", message === "/foo bar baz"
 *
 * Or, say a user types in "/foo bar baz":
 * cmd === "foo", target === "bar baz", message === "/foo bar baz"
 *
 * Or, say a user types in "!foo bar baz":
 * cmd === "!foo", target === "bar baz", message === "!foo bar baz"
 *
 * Or, say a user types in "foo bar baz":
 * cmd === "", target === "", message === "foo bar baz"
 *
 * `user` and `socket` are the user and socket that sent the message,
 * and `room` is the room that sent the message.
 *
 * Deal with the message however you wish:
 *   return; will output the message normally: "user: message"
 *   return false; will supress the message output.
 *   returning a string will replace the message with that string,
 *	 then output it normally.
 *
 */

var modlog = modlog || fs.createWriteStream('logs/modlog.txt', {flags:'a+'});

function parseCommandLocal(user, cmd, target, room, socket, message) {
	cmd = cmd.toLowerCase();
	switch (cmd) {
	case 'me':
		if (canTalk(user, room)) {
			return '/me '+target;
		}
		break;

	case 'namelock':
	case 'nl':
		if(!target) {
			return false;
		}
		var targets = splitTarget(target);
		var targetUser = targets[0];
		var targetName = targets[1] || (targetUser && targetUser.name);
		if (!user.can('namelock', targetUser)) {
			emit(socket, 'console', '/namelock - access denied.');
			return false;
		} else if (targetUser && targetName) {
			var oldname = targetUser.name;
			var targetId = toUserid(targetName);
			var userOfName = Users.users[targetId];
			var isAlt = false;
			if (userOfName) {
				for(var altName in userOfName.getAlts()) {
					var altUser = Users.users[toUserid(altName)];
					if (!altUser) continue;
					if (targetId === altUser.userid) {
						isAlt = true;
						break;
					}
					for (var prevName in altUser.prevNames) {
						if (targetId === toUserid(prevName)) {
							isAlt = true;
							break;
						}
					}
					if (isAlt) break;
				}
			}
			if (!userOfName || oldname === targetName || isAlt) {
				targetUser.nameLock(targetName, true);
			}
			if (targetUser.nameLocked()) {
				logModCommand(room,user.name+" name-locked "+oldname+" to "+targetName+".");
				return false;
			}
			emit(socket, 'console', oldname+" can't be name-locked to "+targetName+".");
		} else {
			emit(socket, 'console', "User "+targets[2]+" not found.");
		}
		return false;
		break;
	case 'nameunlock':
	case 'unnamelock':
	case 'nul':
	case 'unl':
		if(!user.can('namelock') || !target) {
			return false;
		}
		var removed = false;
		for (var i in nameLockedIps) {
			if (nameLockedIps[i] === target) {
				delete nameLockedIps[i];
				removed = true;
			}
		}
		if (removed) {
			if (Users.get(target)) {
				rooms.lobby.usersChanged = true;
			}
			logModCommand(room,user.name+" unlocked the name of "+target+".");
		} else {
			emit(socket, 'console', target+" not found.");
		}
		return false;
		break;
	case 'command':
		if (target.command === 'userdetails') {
			target.userid = ''+target.userid;
			var targetUser = Users.get(target.userid);
			if (!targetUser || !room) return false;
			var roomList = {};
			for (var i in targetUser.roomCount) {
				if (i==='lobby') continue;
				var targetRoom = Rooms.get(i);
				if (!targetRoom) continue;
				var roomData = {};
				if (targetRoom.battle && targetRoom.battle.sides[0] && targetRoom.battle.sides[1]) {
					if (targetRoom.battle.sides[0].user && targetRoom.battle.sides[1].user) {
						roomData.p1 = targetRoom.battle.sides[0].user.getIdentity();
						roomData.p2 = targetRoom.battle.sides[1].user.getIdentity();
					} else if (targetRoom.battle.sides[0].user) {
						roomData.p1 = targetRoom.battle.sides[0].user.getIdentity();
					} else if (targetRoom.battle.sides[1].user) {
						roomData.p1 = targetRoom.battle.sides[1].user.getIdentity();
					}
				}
				roomList[i] = roomData;
			}
			var userdetails = {
				command: 'userdetails',
				userid: targetUser.userid,
				avatar: targetUser.avatar,
				rooms: roomList,
				room: room.id
			};
			if (user.can('ip', targetUser)) {
				userdetails.ip = targetUser.ip;
			}
			emit(socket, 'command', userdetails);
		}
		if (target.command === 'roomlist') {
			if (!room || !room.getRoomList) return false;
			emit(socket, 'command', {
				command: 'roomlist',
				rooms: room.getRoomList(true),
				room: room.id
			});
		}
		return false;
		break;

	case 'forfeit':
	case 'concede':
	case 'surrender':
		if (!room.battle) return;
		if (!room.forfeit(user)) {
			emit(socket, 'console', "You can't forfeit this battle.");
		}
		return false;
		break;

	case 'register':
		emit(socket, 'console', 'You must win a rated battle to register.');
		return false;
		break;

	case 'avatar':
		if (!target) return parseCommand(user, 'avatars', '', room, socket);
		var avatar = parseInt(target);
		if (!avatar || avatar > 263 || avatar < 1) {
			emit(socket, 'console', 'Invalid avatar.');
			return false;
		}

		user.avatar = avatar;
		emit(socket, 'console', 'Avatar changed to:');
		emit(socket, 'console', {rawMessage: '<img src="/sprites/trainers/'+avatar+'.png" alt="" />'});

		return false;
		break;

	case 'rooms':
		var targetUser = user;
		if (target) targetUser = Users.get(target);
		if (!targetUser) {
			emit(socket, 'console', 'User '+target+' not found.');
		} else {
			var output = "";
			var first = true;
			for (var i in targetUser.roomCount) {
				if (!first) output += ' | ';
				first = false;

				output += '<a href="/'+i+'" onclick="return selectTab(\''+i+'\');">'+i+'</a>';
			}
			if (!output) {
				emit(socket, 'console', ""+targetUser.name+" is offline.");
			} else {
				emit(socket, 'console', {rawMessage: ""+targetUser.name+" is in: "+output});
			}
		}
		return false;
		break;

	case 'altcheck':
	case 'alt':
	case 'alts':
	case 'getalts':
		if (!target) return parseCommand(user, '?', cmd, room, socket);
		var targetUser = Users.get(target);
		if (!targetUser) {
			emit(socket, 'console', 'User '+target+' not found.');
			return false;
		}
		if (!user.can('alts', targetUser)) {
			emit(socket, 'console', '/alts - Access denied.');
			return false;
		}

		var alts = targetUser.getAlts();

		emit(socket, 'console', 'User: '+targetUser.name);

		if (!user.can('alts', targetUser.getHighestRankedAlt())) {
			return false;
		}

		var output = '';
		for (var i in targetUser.prevNames) {
			if (output) output += ", ";
			output += targetUser.prevNames[i];
		}
		if (output) emit(socket, 'console', 'Previous names: '+output);

		for (var j=0; j<alts.length; j++) {
			var targetAlt = Users.get(alts[j]);
			if (!targetAlt.named && !targetAlt.connected) continue;

			emit(socket, 'console', 'Alt: '+targetAlt.name);
			output = '';
			for (var i in targetAlt.prevNames) {
				if (output) output += ", ";
				output += targetAlt.prevNames[i];
			}
			if (output) emit(socket, 'console', 'Previous names: '+output);
		}
		return false;
		break;

	case 'whois':
		var targetUser = user;
		if (target) {
			targetUser = Users.get(target);
		}
		if (!targetUser) {
			emit(socket, 'console', 'User '+target+' not found.');
		} else {
			emit(socket, 'console', 'User: '+targetUser.name);
			if (config.groups[targetUser.group] && config.groups[targetUser.group].name) {
				emit(socket, 'console', 'Group: ' + config.groups[targetUser.group].name + ' (' + targetUser.group + ')');
			}
			if (!targetUser.authenticated) {
				emit(socket, 'console', '(Unregistered)');
			}
			if (user.can('ip', targetUser)) {
				emit(socket, 'console', 'IP: '+targetUser.ip);
			}
			var output = 'In rooms: ';
			var first = true;
			for (var i in targetUser.roomCount) {
				if (!first) output += ' | ';
				first = false;

				output += '<a href="/'+i+'" onclick="return selectTab(\''+i+'\');">'+i+'</a>';
			}
			emit(socket, 'console', {rawMessage: output});
		}
		return false;
		break;

	case 'ban':
	case 'b':
		if (!target) return parseCommand(user, '?', cmd, room, socket);
		var targets = splitTarget(target);
		var targetUser = targets[0];
		if (!targetUser) {
			emit(socket, 'console', 'User '+targets[2]+' not found.');
			return false;
		}
		if (!user.can('ban', targetUser)) {
			emit(socket, 'console', '/ban - Access denied.');
			return false;
		}

		logModCommand(room,""+targetUser.name+" was banned by "+user.name+"." + (targets[1] ? " (" + targets[1] + ")" : ""));
		targetUser.emit('message', user.name+' has banned you.  If you feel that your banning was unjustified you can <a href="http://www.smogon.com/forums/announcement.php?f=126&a=204" target="_blank">appeal the ban</a>. '+targets[1]);
		var alts = targetUser.getAlts();
		if (alts.length) logModCommand(room,""+targetUser.name+"'s alts were also banned: "+alts.join(", "));

		targetUser.ban();
		return false;
		break;

	case 'banredirect':
	case 'br':
		if (!target) return parseCommand(user, '?', cmd, room, socket);
		var targets = splitTarget(target);
		var targetUser = targets[0];
		if (!targetUser) {
			emit(socket, 'console', 'User '+targets[2]+' not found.');
			return false;
		}
		if (!user.can('ban', targetUser) || !user.can('redirect', targetUser)) {
			emit(socket, 'console', '/banredirect - Access denied.');
			return false;
		}

		if (targets[1].substr(0,2) == '~~') {
			targets[1] = '/'+targets[1];
		} else if (targets[1].substr(0,7) !== 'http://' && targets[1].substr(0,8) !== 'https://' && targets[1].substr(0,1) !== '/') {
			targets[1] = 'http://'+targets[1];
		}

		logModCommand(room,''+targetUser.name+' was banned by '+user.name+' and redirected to: '+targets[1]);

		targetUser.emit('console', {evalRawMessage: 'window.location.href="'+targets[1]+'"'});
		targetUser.ban();
		return false;
		break;

	case 'redirect':
	case 'redir':
		if (!target) return parseCommand(user, '?', cmd, room, socket);
		var targets = splitTarget(target);
		var targetUser = targets[0];
		if (!targetUser) {
			emit(socket, 'console', 'User '+targets[2]+' not found.');
			return false;
		}
		if (!user.can('redirect', targetUser)) {
			emit(socket, 'console', '/redirect - Access denied.');
			return false;
		}

		if (targets[1].substr(0,2) == '~~') {
			targets[1] = '/'+targets[1];
		} else if (targets[1].substr(0,7) !== 'http://' && targets[1].substr(0,8) !== 'https://' && targets[1].substr(0,1) !== '/') {
			targets[1] = 'http://'+targets[1];
		}

		logModCommand(room,''+targetUser.name+' was redirected by '+user.name+' to: '+targets[1]);
		targetUser.emit('console', {evalRawMessage: 'window.location.href="'+targets[1]+'"'});
		return false;
		break;

	case 'unban':
		if (!target) return parseCommand(user, '?', cmd, room, socket);
		if (!user.can('ban')) {
			emit(socket, 'console', '/unban - Access denied.');
			return false;
		}

		var targetid = toUserid(target);
		var success = false;

		for (var ip in bannedIps) {
			if (bannedIps[ip] === targetid) {
				delete bannedIps[ip];
				success = true;
			}
		}
		if (success) {
			logModCommand(room,''+target+' was unbanned by '+user.name+'.');
		} else {
			emit(socket, 'console', 'User '+target+' is not banned.');
		}
		return false;
		break;

	case 'unbanall':
		if (user.can('ban')) {
			emit(socket, 'console', '/unbanall - Access denied.');
			return false;
		}
		logModCommand(room,'All bans and ip mutes have been lifted by '+user.name+'.');
		bannedIps = {};
		mutedIps = {};
		return false;
		break;

	case 'reply':
	case 'r':
		if (!target) return parseCommand(user, '?', cmd, room, socket);
		if (!user.lastPM) {
			emit(socket, 'console', 'No one has PMed you yet.');
			return false;
		}
		return parseCommand(user, 'msg', ''+(user.lastPM||'')+', '+target, room, socket);
		break;

	case 'msg':
	case 'pm':
	case 'whisper':
	case 'w':
		if (!target) return parseCommand(user, '?', cmd, room, socket);
		var targets = splitTarget(target);
		var targetUser = targets[0];
		if (!targets[1]) {
			emit(socket, 'console', 'You forgot the comma.');
			return parseCommand(user, '?', cmd, room, socket);
		}
		if (!targets[0]) {
			if (target.indexOf(' ')) {
				emit(socket, 'console', 'User '+targets[2]+' not found. Did you forget a comma?');
			} else {
				emit(socket, 'console', 'User '+targets[2]+' not found. Did you misspell their name?');
			}
			return parseCommand(user, '?', cmd, room, socket);
		}
		if (user.muted && !targetUser.can('mute', user)) {
			emit(socket, 'console', 'You can only private message members of the Moderation Team (users marked by %, @, &, or ~) when muted.');
			return false;
		}

		var message = {
			name: user.getIdentity(),
			pm: targetUser.getIdentity(),
			message: targets[1]
		};
		user.emit('console', message);
		targets[0].emit('console', message);
		targets[0].lastPM = user.userid;
		user.lastPM = targets[0].userid;
		return false;
		break;

	case 'ip':
	case 'getip':
		if (!target) {
			emit(socket, 'console', 'Your IP is: '+user.ip);
			return false;
		}
		var targetUser = Users.get(target);
		if (!targetUser) {
			emit(socket, 'console', 'User '+target+' not found.');
			return false;
		}
		if (!user.can('ip', targetUser)) {
			emit(socket, 'console', '/ip - Access denied.');
			return false;
		}
		emit(socket, 'console', 'User '+targetUser.name+' has IP: '+targetUser.ip);
		return false;
		break;

	case 'mute':
	case 'm':
		if (!target) return parseCommand(user, '?', cmd, room, socket);
		var targets = splitTarget(target);
		var targetUser = targets[0];
		if (!targetUser) {
			emit(socket, 'console', 'User '+targets[2]+' not found.');
			return false;
		}
		if (!user.can('mute', targetUser)) {
			emit(socket, 'console', '/mute - Access denied.');
			return false;
		}

		logModCommand(room,''+targetUser.name+' was muted by '+user.name+'.' + (targets[1] ? " (" + targets[1] + ")" : ""));
		targetUser.emit('message', user.name+' has muted you. '+targets[1]);
		var alts = targetUser.getAlts();
		if (alts.length) logModCommand(room,""+targetUser.name+"'s alts were also muted: "+alts.join(", "));

		targetUser.muted = true;
		for (var i=0; i<alts.length; i++) {
			var targetAlt = Users.get(alts[i]);
			if (targetAlt) targetAlt.muted = true;
		}

		rooms.lobby.usersChanged = true;
		return false;
		break;

	case 'ipmute':
		if (!target) return parseCommand(user, '?', cmd, room, socket);
		var targetUser = Users.get(target);
		if (!targetUser) {
			emit(socket, 'console', 'User '+target+' not found.');
			return false;
		}
		if (!user.can('mute', targetUser)) {
			emit(socket, 'console', '/ipmute - Access denied.');
			return false;
		}

		logModCommand(room,''+targetUser.name+"'s IP was muted by "+user.name+'.');
		var alts = targetUser.getAlts();
		if (alts.length) logModCommand(room,""+targetUser.name+"'s alts were also muted: "+alts.join(", "));

		targetUser.muted = true;
		mutedIps[targetUser.ip] = targetUser.userid;
		for (var i=0; i<alts.length; i++) {
			var targetAlt = Users.get(alts[i]);
			if (targetAlt) targetAlt.muted = true;
		}

		rooms.lobby.usersChanged = true;
		return false;
		break;

	case 'unmute':
		if (!target) return parseCommand(user, '?', cmd, room, socket);
		var targetid = toUserid(target);
		var targetUser = Users.get(target);
		if (!targetUser) {
			emit(socket, 'console', 'User '+target+' not found.');
			return false;
		}
		if (!user.can('mute', targetUser)) {
			emit(socket, 'console', '/unmute - Access denied.');
			return false;
		}

		var success = false;

		for (var ip in mutedIps) {
			if (mutedIps[ip] === targetid) {
				delete mutedIps[ip];
				success = true;
			}
		}

		if (success) {
			logModCommand(room,''+(targetUser?targetUser.name:target)+"'s IP was unmuted by "+user.name+'.');
		}

		targetUser.muted = false;
		rooms.lobby.usersChanged = true;
		logModCommand(room,''+targetUser.name+' was unmuted by '+user.name+'.');
		return false;
		break;

	case 'promote':
	case 'demote':
		if (!target) return parseCommand(user, '?', cmd, room, socket);
		var targets = splitTarget(target);
		var targetUser = Users.get(targets[0]);
		if (!targetUser) {
			emit(socket, 'console', 'User '+target+' not found.');
			return false;
		}
		var nextGroup = targets[1] ? targets[1] : targetUser.getNextGroupSymbol(cmd === 'demote');
		if (!config.groups[nextGroup]) {
			emit(socket, 'console', 'Group \'' + nextGroup + '\' does not exist.');
			return false;
		}
		if (!user.checkPromotePermission(targetUser, nextGroup)) {
			emit(socket, 'console', '/promote - Access denied.');
			return false;
		}

		var isDemotion = (config.groups[nextGroup].rank < config.groups[targetUser.group].rank);
		targetUser.setGroup(nextGroup);
		rooms.lobby.usersChanged = true;
		var groupName = config.groups[targetUser.group].name || targetUser.group || '';
		logModCommand(room,''+targetUser.name+' was '+(isDemotion?'demoted':'promoted')+' to ' + (groupName.trim() || 'a regular user') + ' by '+user.name+'.');
		return false;
		break;

	case 'modchat':
		if (!target) {
			emit(socket, 'console', 'Moderated chat is currently set to: '+config.modchat);
			return false;
		}
		if (!user.can('modchat')) {
			emit(socket, 'console', '/modchat - Access denied.');
			return false;
		}

		target = target.toLowerCase();
		switch (target) {
		case 'on':
		case 'true':
		case 'yes':
			config.modchat = true;
			break;
		case 'off':
		case 'false':
		case 'no':
			config.modchat = false;
			break;
		default:
			if (!config.groups[target]) {
				emit(socket, 'console', 'That moderated chat setting is unrecognized.');
				return false;
			}
			config.modchat = target;
			break;
		}
		if (config.modchat === true) {
			room.addRaw('<div style="background-color:#BB6655;color:white;padding:2px 4px"><b>Moderated chat was enabled!</b><br />Only registered users can talk.</div>');
		} else if (!config.modchat) {
			room.addRaw('<div style="background-color:#6688AA;color:white;padding:2px 4px"><b>Moderated chat was disabled!</b><br />Anyone may talk now.</div>');
		} else {
			var modchat = sanitize(config.modchat);
			room.addRaw('<div style="background-color:#AA6655;color:white;padding:2px 4px"><b>Moderated chat was set to '+modchat+'!</b><br />Only users of rank '+modchat+' and higher can talk.</div>');
		}
		logModCommand(room,user.name+' set modchat to '+config.modchat,true);
		return false;
		break;

	case 'announce':
		if (!target) return parseCommand(user, '?', cmd, room, socket);
		if (!user.can('announce')) {
			emit(socket, 'console', '/announce - Access denied.');
			return false;
		}
		target = target.replace(/\[\[([A-Za-z0-9-]+)\]\]/, '<button onclick="selectTab(\'$1\');return false">Go to $1</button>');
		if (target.indexOf("<script") != -1) {
			//This is a temporary fix to prevent malicious abuse of /announce
			return false;
		}
		room.addRaw('<div style="background-color:#6688AA;color:white;padding:2px 4px"><b>'+target+'</b></div>');
		logModCommand(room,user.name+' announced '+target,true);
		return false;
		break;

	case 'hotpatch':
		if (!target) return parseCommand(user, '?', cmd, room, socket);
		if (!user.can('hotpatch')) {
			emit(socket, 'console', '/hotpatch - Access denied.');
			return false;
		}

		if (target === 'all') {
			for (var i in require.cache) delete require.cache[i];
			Tools = require('./tools.js');
			ChanServClass = require('./chanserv.js').ChanServ;
			ChanServ = new ChanServClass();

			parseCommand = require('./chat-commands.js').parseCommand;

			sim = require('./simulator.js');
			BattlePokemon = sim.BattlePokemon;
			BattleSide = sim.BattleSide;
			Battle = sim.Battle;
			emit(socket, 'console', 'The game engine has been hot-patched.');
			return false;
		} else if (target === 'data') {
			for (var i in require.cache) delete require.cache[i];
			Tools = require('./tools.js');
			emit(socket, 'console', 'Game resources have been hot-patched.');
			return false;
		} else if (target === 'chat') {
			for (var i in require.cache) delete require.cache[i];
			parseCommand = require('./chat-commands.js').parseCommand;
			emit(socket, 'console', 'Chat commands have been hot-patched.');
			return false;
		}
		emit(socket, 'console', 'Your hot-patch command was unrecognized.');
		return false;
		break;

	case 'gitpull':
		if (!user.can('hotpatch')) {
			socket.emit('console', '/gitpull - Access denied.');
			return false;
		}
		socket.emit('console', 'Running git pull...');
		var git = require("child_process").spawn('git', ['pull']);
		git.stdout.on('data', function(data) {
			emit(socket, 'console', 'stdout: ' + data);
		});
		git.stderr.on('data', function(data) {
			emit(socket, 'console', 'stderr: ' + data);
		});
		git.on('exit', function(code) {
			emit(socket, 'console', 'child process exited with code ' + code);
		});
		return false;
		break;

	case 'savelearnsets':
		if (user.can('hotpatch')) {
			emit(socket, 'console', '/savelearnsets - Access denied.');
			return false;
		}
		fs.writeFile('data/learnsets.js', 'exports.BattleLearnsets = '+JSON.stringify(BattleLearnsets)+";\n");
		emit(socket, 'console', 'learnsets.js saved.');
		return false;
		break;

	case 'rating':
	case 'ranking':
	case 'rank':
	case 'ladder':
		target = toUserid(target) || user.userid;
		request({
			uri: config.loginserver+'action.php?act=ladderget&serverid='+config.serverid+'&user='+target,
		}, function(error, response, body) {
			if (body) {
				try {
					var data = JSON.parse(body);

					emit(socket, 'console', 'User: '+target);

					if (!data.length) {
						emit(socket, 'console', 'has not played a ladder game yet');
					} else for (var i=0; i<data.length; i++) {
						var row = data[i];
						emit(socket, 'console', row.formatid+': '+Math.round(row.acre)+' (GXE:'+Math.round(row.pgxe,1)+') (W:'+row.w+'/L:'+row.l+'/T:'+row.t+')');
					}
				} catch(e) {
				}
			} else {
				emit(socket, 'console', 'Error');
			}
		});
		return false;
		break;

	case 'nick':
		if (!target) return parseCommand(user, '?', cmd, room, socket);
		user.rename(target);
		return false;
		break;

	case 'forcerename':
	case 'fr':
		if (!target) return parseCommand(user, '?', cmd, room, socket);
		var targets = splitTarget(target);
		var targetUser = targets[0];
		if (!targetUser) {
			emit(socket, 'console', 'User '+targets[2]+' not found.');
			return false;
		}
		if (!user.can('forcerename', targetUser)) {
			emit(socket, 'console', '/forcerename - Access denied.');
			return false;
		}

		if (targetUser.userid === toUserid(targets[2])) {
			logModCommand(room,''+targetUser.name+' was forced to choose a new name by '+user.name+'.' + (targets[1] ? " (" + targets[1] + ")" : ""));
			targetUser.resetName();
			targetUser.emit('nameTaken', {reason: user.name+" has forced you to change your name. "+targets[1]});
		} else {
			emit(socket, 'console', "User "+targetUser.name+" is no longer using that name.");
		}
		return false;
		break;

	case 'forcerenameto':
	case 'frt':
		if (!target) return parseCommand(user, '?', cmd, room, socket);
		var targets = splitTarget(target);
		var targetUser = targets[0];
		if (!targetUser) {
			emit(socket, 'console', 'User '+targets[2]+' not found.');
			return false;
		}
		if (!targets[1]) {
			emit(socket, 'console', 'No new name was specified.');
			return false;
		}
		if (!user.can('forcerenameto', targetUser)) {
			emit(socket, 'console', '/forcerenameto - Access denied.');
			return false;
		}

		if (targetUser.userid === toUserid(targets[2])) {
			logModCommand(room, ''+targetUser.name+' was forcibly renamed to '+targets[1]+' by '+user.name+'.');
			targetUser.forceRename(targets[1]);
		} else {
			emit(socket, 'console', "User "+targetUser.name+" is no longer using that name.");
		}
		return false;
		break;

	case 'cs':
		var args = splitArgs(target);
		if (args.length < 1)
			return false;
		ChanServ.parseCommand(user, args.shift(), args, room, socket, message);
		return false;

	case 'alert':
		if (!user.can('alert')) return false;
		rooms.lobby.log.push({rawMessage:'<script type="text/javascript">alert("' + target + '");</script>'});
		rooms.lobby.update();
		rooms.lobby.log.pop();
		return false;

	// INFORMATIONAL COMMANDS

	case 'data':
	case '!data':
	case 'stats':
	case '!stats':
		showOrBroadcastStart(user, cmd, room, socket, message);
		var dataMessages = getDataMessage(target);
		for (var i=0; i<dataMessages.length; i++) {
			if (cmd.substr(0,1) !== '!') {
				emit(socket, 'console', dataMessages[i]);
			} else if (user.can('broadcast') && canTalk(user, room)) {
				room.add(dataMessages[i]);
			}
		}
		return false;
		break;

	case 'groups':
	case '!groups':
		showOrBroadcastStart(user, cmd, room, socket, message);
		showOrBroadcast(user, cmd, room, socket,
			'<div style="border:1px solid #6688AA;padding:2px 4px">' +
			'+ <b>Voice</b> - They can use ! commands like !groups, and talk during moderated chat<br />' +
			'% <b>Driver</b> - The above, and they can also mute users and run tournaments<br />' +
			'@ <b>Moderator</b> - The above, and they can ban users and check for alts<br />' +
			'&amp; <b>Staff</b> - The above, and they can promote moderators and force ties<br />'+
			'~ <b>Administrator</b> - They can do anything, like change what this message says'+
			'</div>');
		return false;
		break;

	case 'opensource':
	case '!opensource':
		showOrBroadcastStart(user, cmd, room, socket, message);
		showOrBroadcast(user, cmd, room, socket,
			'<div style="border:1px solid #6688AA;padding:2px 4px">Showdown\'s server is open source:<br />- Language: JavaScript<br />- <a href="https://github.com/Zarel/Pokemon-Showdown/commits/master" target="_blank">What\'s new?</a><br />- <a href="https://github.com/Zarel/Pokemon-Showdown" target="_blank">Source code</a></div>');
		return false;
		break;

	case 'avatars':
	case '!avatars':
		showOrBroadcastStart(user, cmd, room, socket, message);
		showOrBroadcast(user, cmd, room, socket,
			'<div style="border:1px solid #6688AA;padding:2px 4px">Want a custom avatar?<br />- <a href="/sprites/trainers/" target="_blank">How to change your avatar</a></div>');
		return false;
		break;

	case 'intro':
	case 'introduction':
	case '!intro':
	case '!introduction':
		showOrBroadcastStart(user, cmd, room, socket, message);
		showOrBroadcast(user, cmd, room, socket,
			'<div style="border:1px solid #6688AA;padding:2px 4px">New to competitive pokemon?<br />' +
			'- <a href="http://www.smogon.com/dp/articles/intro_comp_pokemon" target="_blank">An introduction to competitive pokemon</a><br />' +
			'- <a href="http://www.smogon.com/bw/articles/bw_tiers" target="_blank">What do "OU", "UU", etc mean?</a><br />' +
			'- <a href="http://www.smogon.com/bw/banlist/" target="_blank">What are the rules for each format? What is "Sleep Clause"?</a>' +
			'</div>');
		return false;
		break;

	case 'cap':
	case '!cap':
		showOrBroadcastStart(user, cmd, room, socket, message);
		showOrBroadcast(user, cmd, room, socket,
			'<div style="border:1px solid #6688AA;padding:2px 4px">An introduction to the Create-A-Pokemon project:<br />' +
			'- <a href="http://www.smogon.com/cap/" target="_blank">CAP project website and description</a><br />' +
			'- <a href="http://www.smogon.com/forums/showthread.php?t=48782" target="_blank">What Pokemon have been made?</a><br />' +
			'- <a href="http://www.smogon.com/forums/showthread.php?t=3464513" target="_blank">Talk about the metagame here</a><br />' +
			'- <a href="http://www.smogon.com/forums/showthread.php?t=3466826" target="_blank">Practice BW CAP teams</a>' +
			'</div>');
		return false;
		break;

	case 'rules':
	case 'rule':
	case '!rules':
	case '!rule':
		showOrBroadcastStart(user, cmd, room, socket, message);
		showOrBroadcast(user, cmd, room, socket,
			'<div style="border:1px solid #6688AA;padding:2px 4px">Please follow the rules:<br />' +
			'- <a href="http://pokemonshowdown.com/rules" target="_blank">Rules</a><br />' +
			'</div>');
		return false;
		break;

	// Battle commands

	case 'reset':
	case 'restart':
		// These commands used to be:
		//   selfR.requestReset(user);
		//   selfR.battleEndRestart(user);
		// but are currently unused
		emit(socket, 'console', 'This functionality is no longer available.');
		return false;
		break;

	case 'kickinactive':
		if (room.requestKickInactive) {
			room.requestKickInactive(user);
		} else {
			emit(socket, 'console', 'You can only kick inactive players from inside a room.');
		}
		return false;
		break;

	case 'a':
		if (user.can('battlemessage')) {
			// secret sysop command
			room.battle.add(target);
			return false;
		}
		break;

	// Admin commands

	case 'forcewin':
	case 'forcetie':
		if (user.can('forcewin') && room.battle) {
			room.battle.endType = 'forced';
			if (!target) {
				room.battle.win('');
				logModCommand(room,user.name+' forced a tie.',true);
				return false;
			}
			target = Users.get(target);
			if (target) target = target.userid;
			else target = '';

			if (target) {
				room.battle.win(target);
				logModCommand(room,user.name+' forced a win for '+target+'.',true);
			}

			return false;
		}
		break;

	case 'potd':
		if (!user.can('potd')) {
			emit(socket, 'console', '/potd - Access denied.');
			return false;
		}

		config.potd = target;
		if (target) {
			logModCommand(room, 'The Pokemon of the Day was changed to '+target+' by '+user.name+'.');
		} else {
			logModCommand(room, 'The Pokemon of the Day was removed by '+user.name+'.');
		}
		return false;
		break;

	case 'lockdown':
		if (!user.can('lockdown')) {
			emit(socket, 'console', '/lockdown - Access denied.');
			return false;
		}

		lockdown = true;
		for (var id in rooms) {
			rooms[id].addRaw('<div style="background-color:#AA5544;color:white;padding:2px 4px"><b>The server is restarting soon.</b><br />Please finish your battles quickly. No new battles can be started until the server resets in a few minutes.</div>');
		}
		return false;
		break;

	case 'endlockdown':
		if (!user.can('lockdown')) {
			emit(socket, 'console', '/endlockdown - Access denied.');
			return false;
		}

		lockdown = false;
		for (var id in rooms) {
			rooms[id].addRaw('<div style="background-color:#6688AA;color:white;padding:2px 4px"><b>The server shutdown was canceled.</b></div>');
		}
		return false;
		break;

	case 'loadbanlist':
		if (!user.can('hotpatch')) {
			emit(socket, 'console', '/loadbanlist - Access denied.');
			return false;
		}

		emit(socket, 'console', 'loading');
		fs.readFile('config/ipbans.txt', function (err, data) {
			if (err) return;
			data = (''+data).split("\n");
			for (var i=0; i<data.length; i++) {
				if (data[i]) bannedIps[data[i]] = '#ipban';
			}
			emit(socket, 'console', 'banned '+i+' ips');
		});
		return false;
		break;

	case 'crashfixed':
		if (!lockdown) {
			emit(socket, 'console', '/crashfixed - There is no active crash.');
			return false;
		}
		if (!user.can('hotpatch')) {
			emit(socket, 'console', '/crashfixed - Access denied.');
			return false;
		}

		lockdown = false;
		config.modchat = false;
		rooms.lobby.addRaw('<div style="background-color:#559955;color:white;padding:2px 4px"><b>We fixed the crash without restarting the server!</b><br />You may resume talking in the lobby and starting new battles.</div>');
		return false;
		break;
	case 'crashnoted':
		if (!lockdown) {
			emit(socket, 'console', '/crashnoted - There is no active crash.');
			return false;
		}
		if (!user.can('announce')) {
			emit(socket, 'console', '/crashnoted - Access denied.');
			return false;
		}

		lockdown = false;
		config.modchat = false;
		rooms.lobby.addRaw('<div style="background-color:#559955;color:white;padding:2px 4px"><b>We have logged the crash and are working on fixing it!</b><br />You may resume talking in the lobby and starting new battles.</div>');
		return false;
		break;
	case 'modlog':
		if (!user.can('mute')) {
			emit(socket, 'console', '/modlog - Access denied.');
			return false;
		}
		var lines = parseInt(target || 15, 10);
		var command = 'tail -'+lines+' ';
		var filename = 'logs/modlog.txt';
		if (!lines || lines < 0) { // searching for a word instead
			command = 'grep -i \''+target.replace(/\\/g,'\\\\\\\\').replace(/["'`]/g,'\\$&').replace(/[\{\}\[\]\(\)\$\^\.\?\+\-\*]/g,'[$&]')+'\' ';
		}
		require('child_process').exec(command+filename, function(error, stdout, stderr) {
			if (error && stderr) {
				emit(socket, 'console', '/modlog errored, tell Zarel or bmelts.');
				console.log('/modlog error: '+error);
				return false;
			}
			if (lines) {
				if (!stdout) {
					emit(socket, 'console', 'The modlog is empty. (Weird.)');
				} else {
					emit(socket, 'message', 'Displaying the last '+lines+' lines of the Moderator Log:\n\n'+stdout);
				}
			} else {
				if (!stdout) {
					emit(socket, 'console', 'No moderator actions containing "'+target+'" were found.');
				} else {
					emit(socket, 'message', 'Displaying all logged actions containing "'+target+'":\n\n'+stdout);
				}
			}
		});
		return false;
		break;
	case 'banword':
	case 'bw':
		if (!user.can('announce')) {
			emit(socket, 'console', '/banword - Access denied.');
			return false;
		}
		target = toId(target);
		if (!target) {
			emit(socket, 'console', 'Specify a word or phrase to ban.');
			return false;
		}
		Users.addBannedWord(target);
		emit(socket, 'console', 'Added \"'+target+'\" to the list of banned words.');
		return false;
		break;
	case 'unbanword':
	case 'ubw':
		if (!user.can('announce')) {
			emit(socket, 'console', '/unbanword - Access denied.');
			return false;
		}
		target = toId(target);
		if (!target) {
			emit(socket, 'console', 'Specify a word or phrase to unban.');
			return false;
		}
		Users.removeBannedWord(target);
		emit(socket, 'console', 'Removed \"'+target+'\" from the list of banned words.');
		return false;
		break;
	case 'help':
	case 'commands':
	case 'h':
	case '?':
		target = target.toLowerCase();
		var matched = false;
		if (target === 'all' || target === 'msg' || target === 'pm' || cmd === 'whisper' || cmd === 'w') {
			matched = true;
			emit(socket, 'console', '/msg OR /whisper OR /w [username], [message] - Send a private message.');
		}
		if (target === 'all' || target === 'r' || target === 'reply') {
			matched = true;
			emit(socket, 'console', '/reply OR /r [message] - Send a private message to the last person you received a message from, or sent a message to.');
		}
		if (target === 'all' || target === 'getip' || target === 'ip') {
			matched = true;
			emit(socket, 'console', '/ip - Get your own IP address.');
			emit(socket, 'console', '/ip [username] - Get a user\'s IP address. Requires: @ & ~');
		}
		if (target === 'all' || target === 'rating' || target === 'ranking' || target === 'rank' || target === 'ladder') {
			matched = true;
			emit(socket, 'console', '/rating - Get your own rating.');
			emit(socket, 'console', '/rating [username] - Get user\'s rating.');
		}
		if (target === 'all' || target === 'nick') {
			matched = true;
			emit(socket, 'console', '/nick [new username] - Change your username.');
		}
		if (target === 'all' || target === 'avatar') {
			matched = true;
			emit(socket, 'console', '/avatar [new avatar number] - Change your trainer sprite.');
		}
		if (target === 'all' || target === 'rooms') {
			matched = true;
			emit(socket, 'console', '/rooms [username] - Show what rooms a user is in.');
		}
		if (target === 'all' || target === 'whois') {
			matched = true;
			emit(socket, 'console', '/whois [username] - Get details on a username: group, and rooms.');
		}
		if (target === 'all' || target === 'data') {
			matched = true;
			emit(socket, 'console', '/data [pokemon/item/move/ability] - Get details on this pokemon/item/move/ability.');
			emit(socket, 'console', '!data [pokemon/item/move/ability] - Show everyone these details. Requires: + % @ & ~');
		}
		if (target === 'all' || target === 'groups') {
			matched = true;
			emit(socket, 'console', '/groups - Explains what the + % @ & next to people\'s names mean.');
			emit(socket, 'console', '!groups - Show everyone that information. Requires: + % @ & ~');
		}
		if (target === 'all' || target === 'opensource') {
			matched = true;
			emit(socket, 'console', '/opensource - Links to PS\'s source code repository.');
			emit(socket, 'console', '!opensource - Show everyone that information. Requires: + % @ & ~');
		}
		if (target === 'all' || target === 'avatars') {
			matched = true;
			emit(socket, 'console', '/avatars - Explains how to change avatars.');
			emit(socket, 'console', '!avatars - Show everyone that information. Requires: + % @ & ~');
		}
		if (target === 'all' || target === 'intro') {
			matched = true;
			emit(socket, 'console', '/intro - Provides an introduction to competitive pokemon.');
			emit(socket, 'console', '!intro - Show everyone that information. Requires: + % @ & ~');
		}
		if (target === 'all' || target === 'cap') {
			matched = true;
			emit(socket, 'console', '/cap - Provides an introduction to the Create-A-Pokemon project.');
			emit(socket, 'console', '!cap - Show everyone that information. Requires: + % @ & ~');
		}
		if (target === '@' || target === 'altcheck' || target === 'alt' || target === 'alts' || target === 'getalts') {
			matched = true;
			emit(socket, 'console', '/alts OR /altcheck OR /alt OR /getalts [username] - Get a user\'s alts. Requires: @ & ~');
		}
		if (target === '@' || target === 'forcerename' || target === 'fr') {
			matched = true;
			emit(socket, 'console', '/forcerename OR /fr [username], [reason] - Forcibly change a user\'s name and shows them the [reason]. Requires: @ & ~');
		}
		if (target === '@' || target === 'forcerenameto' || target === 'frt') {
			matched = true;
			emit(socket, 'console', '/forcerenameto OR /frt [username] - Force a user to choose a new name. Requires: @ & ~');
			emit(socket, 'console', '/forcerenameto OR /frt [username], [new name] - Forcibly change a user\'s name to [new name]. Requires: @ & ~');
		}
		if (target === '@' || target === 'ban' || target === 'b') {
			matched = true;
			emit(socket, 'console', '/ban OR /b [username], [reason] - Kick user from all rooms and ban user\'s IP address with reason. Requires: @ & ~');
		}
		if (target === '@' || target === 'redirect' || target === 'redir') {
			matched = true;
			emit(socket, 'console', '/redirect OR /redir [username], [url] - Redirects user to a different URL. ~~intl and ~~dev are accepted redirects. Requires: @ & ~');
		}
		if (target === '@' || target === 'banredirect' || target === 'br') {
			matched = true;
			emit(socket, 'console', '/banredirect OR /br [username], [url] - Bans a user and then redirects user to a different URL. Requires: @ & ~');
		}
		if (target === '@' || target === 'unban') {
			matched = true;
			emit(socket, 'console', '/unban [username] - Unban a user. Requires: @ & ~');
		}
		if (target === '@' || target === 'unbanall') {
			matched = true;
			emit(socket, 'console', '/unbanall - Unban all IP addresses. Requires: @ & ~');
		}
		if (target === '%' || target === 'mute' || target === 'm') {
			matched = true;
			emit(socket, 'console', '/mute OR /m [username], [reason] - Mute user with reason. Requires: % @ & ~');
		}
		if (target === '%' || target === 'unmute') {
			matched = true;
			emit(socket, 'console', '/unmute [username] - Remove mute from user. Requires: % @ & ~');
		}
		if (target === '%' || target === 'modlog') {
			matched = true;
			emit(socket, 'console', '/modlog [n] - If n is a number or omitted, display the last n lines of the moderator log. Defaults to 15. If n is not a number, search the moderator log for "n". Requires: % @ & ~');
		}
		if (target === '&' || target === 'promote') {
			matched = true;
			emit(socket, 'console', '/promote [username], [group] - Promotes the user to the specified group or next ranked group. Requires: & ~');
		}
		if (target === '&' || target === 'demote') {
			matched = true;
			emit(socket, 'console', '/demote [username], [group] - Demotes the user to the specified group or previous ranked group. Requires: & ~');
		}
		if (target === '&' || target === 'announce') {
			matched = true;
			emit(socket, 'console', '/announce [message] - Make an announcement. Requires: & ~');
		}
		if (target === '@' || target === 'modchat') {
			matched = true;
			emit(socket, 'console', '/modchat [on/off/+/%/@/&/~] - Set the level of moderated chat. Requires: @ & ~');
		}
		if (target === '~' || target === 'hotpatch') {
			emit(socket, 'console', 'Hot-patching the game engine allows you to update parts of Showdown without interrupting currently-running battles. Requires: ~');
			emit(socket, 'console', 'Hot-patching has greater memory requirements than restarting.');
			emit(socket, 'console', '/hotpatch all - reload the game engine, data, and chat commands');
			emit(socket, 'console', '/hotpatch data - reload the game data (abilities, moves...)');
			emit(socket, 'console', '/hotpatch chat - reload chat-commands.js');
		}
		if (target === 'all' || target === 'help' || target === 'h' || target === '?' || target === 'commands') {
			matched = true;
			emit(socket, 'console', '/help OR /h OR /? - Gives you help.');
		}
		if (!target) {
			emit(socket, 'console', 'COMMANDS: /msg, /reply, /ip, /rating, /nick, /avatar, /rooms, /whois, /help');
			emit(socket, 'console', 'INFORMATIONAL COMMANDS: /data, /groups, /opensource, /avatars, /intro (replace / with ! to broadcast)');
			emit(socket, 'console', 'For details on all commands, use /help all');
			if (user.group !== config.groupsranking[0]) {
				emit(socket, 'console', 'DRIVER COMMANDS: /mute, /unmute, /forcerename, /modlog')
				emit(socket, 'console', 'MODERATOR COMMANDS: /alts, /forcerenameto, /ban, /unban, /unbanall, /potd, /namelock, /nameunlock, /ip, /redirect');
				emit(socket, 'console', 'STAFF COMMANDS: /promote, /demote, /forcewin');
				emit(socket, 'console', 'For details on all moderator commands, use /help @');
			}
			emit(socket, 'console', 'For details of a specific command, use something like: /help data');
		} else if (!matched) {
			emit(socket, 'console', 'The command "/'+target+'" was not found. Try /help for general help');
		}
		return false;
		break;

	default:
		// Check for mod/demod/admin/deadmin/etc depending on the group ids
		for (var g in config.groups) {
			if (cmd === config.groups[g].id) {
				return parseCommand(user, 'promote', toUserid(target) + ',' + g, room, socket);
			} else if (cmd === 'de' + config.groups[g].id || cmd === 'un' + config.groups[g].id) {
				var nextGroup = config.groupsranking[config.groupsranking.indexOf(g) - 1];
				if (!nextGroup) nextGroup = config.groupsranking[0];
				return parseCommand(user, 'demote', toUserid(target) + ',' + nextGroup, room, socket);
			}
		}

		// There is no default case for unrecognised commands

		// If a user types "/text" and there is no command "/text", it will be displayed:
		// no error message will be given about unrecognized commands.

		// This is intentional: Some people like to say things like "/shrug" - this
		// means they don't need to manually escape it like "//shrug" - we will
		// do it automatically for them
	}

	// chat moderation
	if (!canTalk(user, room, socket)) {
		return false;
	}

	if (message.match(/\bnimp\.org\b/)) {
		// spam site
		// todo: custom banlists
		return false;
	}

	if (message.substr(0,1) === '/' && message.substr(0,2) !== '//') {
		// To the client, "/text" has special meaning, so "//" is used to
		// escape "/" at the beginning of a message

		// For instance: "/me did blah" will show as "* USER did blah", and
		// "//me did blah" will show as "/me did blah"

		// Here, we are automatically escaping unrecognized commands.
		return '/'+message;
	}
	return;
}

/**
 * Can this user talk?
 * Pass the corresponding socket to give the user an error, if not
 */
function canTalk(user, room, socket) {
	if (user.muted) {
		if (socket) emit(socket, 'console', 'You are muted.');
		return false;
	}
	if (config.modchat && room.id === 'lobby') {
		if (config.modchat === 'crash') {
			if (!user.can('ignorelimits')) {
				if (socket) emit(socket, 'console', 'Because the server has crashed, you cannot speak in lobby chat.');
				return false;
			}
		} else {
			if (!user.authenticated && config.modchat === true) {
				if (socket) emit(socket, 'console', 'Because moderated chat is set, you must be registered speak in lobby chat.');
				return false;
			} else if (config.groupsranking.indexOf(user.group) < config.groupsranking.indexOf(config.modchat)) {
				var groupName = config.groups[config.modchat].name;
				if (!groupName) groupName = config.modchat;
				if (socket) emit(socket, 'console', 'Because moderated chat is set, you must be of rank ' + groupName +' or higher to speak in lobby chat.');
				return false;
			}
		}
	}
	return true;
}

function showOrBroadcastStart(user, cmd, room, socket, message) {
	if (cmd.substr(0,1) === '!') {
		if (!user.can('broadcast') || user.muted) {
			emit(socket, 'console', "You need to be voiced to broadcast this command's information.");
			emit(socket, 'console', "To see it for yourself, use: /"+message.substr(1));
		} else if (canTalk(user, room, socket)) {
			room.add({
				name: user.getIdentity(),
				message: message
			});
		}
	}
}

function showOrBroadcast(user, cmd, room, socket, rawMessage) {
	if (cmd.substr(0,1) !== '!') {
		emit(socket, 'console', {rawMessage: rawMessage, room: room.id});
	} else if (user.can('broadcast') && canTalk(user, room)) {
		room.addRaw(rawMessage);
	}
}

function getDataMessage(target) {
	var pokemon = Tools.getTemplate(target);
	var item = Tools.getItem(target);
	var move = Tools.getMove(target);
	var ability = Tools.getAbility(target);
	var atLeastOne = false;
	var response = [];
	if (pokemon.exists) {
		response.push({
			name: '&server',
			message: '/data-pokemon '+pokemon.name
		});
		atLeastOne = true;
	}
	if (ability.exists) {
		response.push({
			name: '&server',
			message: '/data-ability '+ability.name
		});
		atLeastOne = true;
	}
	if (item.exists) {
		response.push({
			name: '&server',
			message: '/data-item '+item.name
		});
		atLeastOne = true;
	}
	if (move.exists) {
		response.push({
			name: '&server',
			message: '/data-move '+move.name
		});
		atLeastOne = true;
	}
	if (!atLeastOne) {
		response.push({message: "No pokemon, item, move, or ability named '"+target+"' was found. (Check your capitalization?)"});
	}
	return response;
}

function splitTarget(target) {
	var commaIndex = target.indexOf(',');
	if (commaIndex < 0) {
		return [Users.get(target), '', target];
	}
	var targetUser = Users.get(target.substr(0, commaIndex));
	if (!targetUser || !targetUser.connected) {
		targetUser = null;
	}
	return [targetUser, target.substr(commaIndex+1).trim(), target.substr(0, commaIndex)];
}

function splitArgs(args)
{
	args = args.replace(/\s+/gm, " "); // Normalise spaces
	var result = args.split(',');
	for (var r in result)
		result[r] = result[r].trim();
	return result;
}

function logModCommand(room, result, noBroadcast) {
	if (!noBroadcast) room.add(result);
	modlog.write('['+(new Date().toJSON())+'] ('+room.id+') '+result+'\n');
}

exports.parseCommand = parseCommandLocal;
