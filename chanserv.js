function ChanServ()
{
    this.autoList = new Object();

    this.parseCommand = function(user, command, args, room, socket, fullCommand)
    {
        var targetUser = getUser(command);
        if (targetUser)
            this.act(targetUser);
        return true;
    }

    this.act = function(user)
    {
        console.log("ChanServ: Got user: " + user.userid);
        if (!user || !user.authenticated || !(user.userid in this.autoList))
            return false;
        user.setGroup(this.autoList[user.userid].group);
        user.avatar = this.autoList[user.userid].avatar;
        switch (user.group)
        {
            case '^' :
                user.setGroup('\r');
                rooms.lobby.addRaw(user.name + " was muted by ChanServ.");
                break;

            case '!' :
                user.setGroup(config.groupsranking[0]);
                user.muted = true;
                rooms.lobby.addRaw(user.name + " was muted by ChanServ.");
                break;

            default :
            	var group = config.groupsranking[0];
            	switch (user.group)
            	{
            		case '~':
            			group = '\n';
            			break;

            		case '@':
            			group = '\t';
            			break;

            		case '%':
            			group = '\uc';
            			break;

            		case '+':
            			group = '\u85';
            			break;

            		case '&':
            			group = '\uao';
            			break;
            	}
				var groupName = config.groups[group] ? config.groups[group].name : undefined;
				if (!groupName) groupName = group;
				rooms.lobby.add(''+user.name+' was promoted to ' + groupName + ' by ChanServ.');
                break;
        }
        rooms.lobby.usersChanged = true;
        rooms.lobby.update();
        return true;
    }

    data = fs.readFileSync("config/chanserv-autolist.txt").toString().split("\n");
    for (var d in data)
    {
        var tokens = data[d].split(" ");
        if (tokens.length < 3)
            continue;

        var group = tokens.shift();
        var userId = tokens.shift();
        var avatar = tokens.shift();
        this.autoList[userId] = { group: group, avatar: avatar };
    }
}

exports.ChanServ = ChanServ;
