var trades = {
    transactions: [],
    players:      [],
    loaded: false
};

function Transaction(id, player_list) {
    this.id = id;
    var type;
    var players = {};
    for (var i = 0; i < player_list.length; i++) {
        var info = player_list[i];
        var playerid = info.player || 'other';
        var player = players[playerid] || [];
        player.push(info);
        if (type == undefined)
            type = info.type;
        else if (type != info.type)
            type = '';
        players[playerid] = player;
    }
    this.players = players;
    this.type = type;
}

Transaction.load = function(id) {
    if (trades.transactions[id])
        return trades.transactions[id];

    return undefined;
}

// Format a transaction for a given player for display.
Transaction.prototype.format = function(playerid, N) {
    var player = this.players[playerid];
    if (!player)
        return '';

    if (N == undefined)
        N = 1;

    if (N > player.length)
        return '';

    var trans = player[N-1];
    var text = trans.date;
    switch (trans.type) {
        case 'T':
            text += ": Traded from " + trans.from + " to " + trans.to;
            break;

        case 'Da':
            text += ": Drafted by " + trans.to;
            break;

        case 'F':
            text += ": Signed by " + trans.to;
            break;

        case 'Fg':
            text += ": Granted free agency by " + trans.from;
            break;

        case 'Fo':
            text += ": Signed by " + trans.to;
    }

    return text;
}

// Returns a list of players that were traded to the team
// of the given player.
// Additionally will return anything else received, such
// as money, as an object in the array.
Transaction.prototype.trade_return = function(playerid) {
    // Look up the player and get his 'from' team.
    var player_info = this.players[playerid];
    if (!player_info) // Could not find him!
        return;
    // Default to the first entry in the list.
    // It's possible there are multiple entries, such as
    // a voided trade, but handle that elsewhere..
    var from_team = player_info[0].from;
    // Search for everything TO that team.
    var results = [];
    for (var playerid in this.players) {
        var player = this.players[playerid];
        // Loop though every transaction involving this player.
        for (var i = 0; i < player.length; i++) {
            if (player[i].to == from_team) {
                // Check to see if it's a player.
                if (playerid != 'other') {
                    results.push(playerid);
                }
                else {
                    // Because it needs to be handled specially.
                    results.push({ 'info': player[i].info });
                }
            }
        }
    }

    return results;
}

function show_error(request, status, exception) {
    var msgs = $("#messages");
    msgs.addClass("error");
    msgs.text("Error while loading " + this.url + ": " + exception.message);
}

function initialize() {
    // This loads the master player list.
    // No info is otherwise contained in it. Must fetch each player's
    // file separately. This will improve loading times at the expense
    // of a teeeny bit of lag for each load. With caching, all should be
    // just fine.
    $.ajax({
        url: 'json/players.json',
        dataType: "json",
        success: function(data, status, request) {
            trades.players = data;
            var msgs = $("#messages");
            // No one will see this, but that's okay.
            msgs.text("Done!");
            msgs.hide();
            load_players();
        },
        error: show_error
    });
}

function load_players() {
    var player_list = [];
    for (var id in trades.players) {
        var first = trades.players[id].first;
        var last = trades.players[id].last;
        if (first != "" && last != "") {
            var name = last + ", " + first;
            player_list.push({ name: name, id: id });
        }
    }
    player_list.sort(function(a, b) {
        if (a.name < b.name) return -1;
        else if (a.name == b.name) return 0;
        return 1;
    });

    var options = ['<option value="---" selected="selected" disabled="disabled">Choose a player</option>'];
    for (var i = 0; i < player_list.length; i++) {
        id = player_list[i].id;
        name = player_list[i].name;
        options.push('<option value="' + id + '">' + name + '</option>');
    }
    var contents = options.join("");
    var select = $("#player");
    select.empty();
    select.append(contents);

    var trans = $("#trade");
    trans.empty();
    trans.append('<option value="---" selected="selected" disabled="disabled">Select a player above</option>');

    trades.loaded = true;
}

/*
 * UI functions.
 */

function choose_player(option) {
    if (!trades.loaded) return;

    var playerid = option.value;
    get_player(playerid, function() { show_transactions(playerid); });
}

function choose_transaction(option) {
    var trans_id = option.value;
    var playerid = $("#player").val();

    // Reset the trade tree, and set the traded player
    // as its root.
    var tree = {};
    tree[playerid] = {};
    trades.tree = tree;
}

function create_tree() {
}

function clear_tree() {
    $("#trade-results").empty();
}

/*
 * Internal functions.
 */

// Get a player and all of the transactions that involve him.
// 'func' is the function that will be called when everything
// has been fetched.
function get_player(playerid, func) {
    // Check if already loaded..
    if (verify_downloaded(playerid)) {
        func();
        return;
    }

    $.ajax({
        url: "json/" + playerid + ".json",
        dataType: "json",
        success: function(data, status, request) {
            trades.players[playerid].transactions = data;
            var len = data.length;
            for (var i = 0; i < len; i++) {
                get_each_transaction(playerid, data[i], func);
            }
        },
        error: show_error
    });
}

function get_each_transaction(playerid, id, func) {
    // If it already exists, then don't bother.
    if (trades.transactions[id]) return;

    $.ajax({
        url: "json/" + id + ".json",
        dataType: "json",
        success: function(data, status, request) {
            trades.transactions[id] = new Transaction(id, data);
            if (verify_downloaded(playerid)) {
                func();
            }
        },
        error: show_error
    });
}

function verify_downloaded(playerid) {
    var transactions = trades.players[playerid].transactions;

    if (!transactions) return false;
    for (var i = 0; i < transactions.length; i++) {
        var id = transactions[i];
        if (!trades.transactions[id]) return false;
    }
    return true;
}

function show_transactions(playerid) {
    var transactions = trades.players[playerid].transactions;

    var trans_list = [];
    for (var i = 0; i < transactions.length; i++) {
        var id = transactions[i];
        var T = trades.transactions[id];
        if (T.type == 'T') {
            trans_list.push({
                id: id,
                sort: i,
                desc: T.format(playerid)
            });
        }
    }
    trans_list.sort(function(a, b) {
        if (a.sort < b.sort) return -1;
        if (a.sort == b.sort) return 0;
        return 1;
    });

    // If there are no trades located, then change the "prompt".
    // Ideally I could just not display them in the first place, but
    // would need to move that logic into the generator of the JSON.
    var options;
    if (trans_list.length > 0)
        options = ['<option value="---" selected="selected" disabled="disabled">Choose a transaction</option>'];
    else
        options = ['<option value="---" selected="selected" disabled="disabled">No trades found!</option>'];
    var last_trans = -1;
    for (var i = 0; i < trans_list.length; i++) {
        if (trans_list[i].id == last_trans) continue;
        options.push('<option value="' + trans_list[i].id + '">' + trans_list[i].desc + '</option>');
        last_trans = trans_list[i].id;
    }

    var contents = options.join('');
    var trans = $("#trade");
    trans.empty();
    trans.append(contents);
}
