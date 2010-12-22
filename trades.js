var trades = {
    transactions: [],
    players:      [],
    loaded: false
};

function show_error(request, status, exception) {
    msgs = $("#messages");
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
            msgs = $("#messages");
            // No one will see this, but that's okay.
            msgs.text("Done!");
            msgs.hide();
            load_players();
        },
        error: show_error
    });
}

function load_players() {
    player_list = [];
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

function get_player(option) {
    if (!trades.loaded) return;

    var playerid = option.value;
    // Check if already loaded..
    if (trades.transactions[playerid]) {
        // Jump straight into the loading part.
        load_transactions(playerid);
        return;
    }

    $.ajax({
        url: "json/" + playerid + ".json",
        dataType: "json",
        success: function(data, status, request) {
            trades.players[playerid].transactions = data;
            var len = data.length;
            for (var i = 0; i < len; i++) {
                get_each_transaction(playerid, data[i]);
            }
        },
        error: show_error
    });
}

function get_each_transaction(playerid, id) {
    // If it already exists, then don't bother.
    if (trades.transactions[id]) {
        load_transactions(playerid);
        return;
    }
    $.ajax({
        url: "json/" + id + ".json",
        dataType: "json",
        success: function(data, status, request) {
            trades.transactions[id] = data;
            load_transactions(playerid);
        },
        error: show_error
    });
}

function load_transactions(playerid) {
    var transactions = trades.players[playerid].transactions;

    var trans_list = [];
    for (var i = 0; i < transactions.length; i++) {
        var id = transactions[i];
        // Verify that all of the transactions needed are loaded.
        if (!trades.transactions[id]) return;
        trans_list.push({
            id: id,
            sort: i,
            desc: terse_transaction(id, playerid, 1),
        });
    }
    trans_list.sort(function(a, b) {
        if (a.sort < b.sort) return -1;
        if (a.sort == b.sort) return 0;
        return 1;
    });

    var options = ['<option value="---" selected="selected" disabled="disabled">Choose a transaction</option>'];
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

// Returns a terse string for the given transaction id and player.
// N is which line to parse (in case there is more than one).
function terse_transaction(id, playerid, N) {
    if (!trades.transactions[id]) return;
    var times_found = 0;
    for (var i = 0; i < trades.transactions[id].length; i++) {
        line = trades.transactions[id][i];
        if (line.player == playerid) {
            times_found++;
            if (times_found < N) continue;
        }
        // Preliminary response.
        // This will need to be changed to vary per type.
        return line.date + " (" + line.from + " => " + line.to + ")";
    }
}
