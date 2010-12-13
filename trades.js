var trades = {
    transactions: [],
    players:      [],
    loaded: 0
};

function show_error(request, status, exception) {
    msgs = $("#messages");
    msgs.addClass("error");
    msgs.text("Error while loading " + this.url + ": " + exception.message);
}

function initialize() {
    // Fetch the players.json and transactions.json files.
    trades.loaded = 0;
    $.ajax({
        url: 'players.json',
        dataType: "text",
        success: function(data, status, request) {
            trades.players = JSON.parse(data);
            trades.loaded++;
            check_done();
        },
        error: show_error
    });
    $.ajax({
        url: 'transactions.json',
        dataType: "text",
        success: function(data, status, request) {
            trades.transactions = JSON.parse(data);
            trades.loaded++;
            check_done();
        },
        error: show_error
    });
}

function check_done() {
    if (trades.loaded != 2) return;
    msgs = $("#messages");
    // No one will see this, but that's okay.
    msgs.text("Done!");
    msgs.hide();

    // Don't load players until after everything has finished.
    load_players();
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
}

function load_transactions(option) {
    if (trades.loaded != 2) return;
    var playerid = option.value;
    var transactions = trades.players[playerid].transactions;

    var trans_list = [];
    for (var i = 0; i < transactions.length; i++) {
        var id = transactions[i];
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
