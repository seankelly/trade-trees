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
        var name = trades.players[id].name;
        if (name != "")
            player_list.push({ name: name, id: id });
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
        trans_list.push(transactions[i]);
    }
    trans_list.sort(function(a, b) {
        return (a - b);
    });

    var options = ['<option value="---" selected="selected" disabled="disabled">Choose a transaction</option>'];
    var last_trans = -1;
    for (var i = 0; i < trans_list.length; i++) {
        var id = trans_list[i];
        if (id == last_trans) continue;
        options.push('<option value="' + id + '">' + id + '</option>');
        last_trans = id;
    }

    var contents = options.join('');
    var trans = $("#trade");
    trans.empty();
    trans.append(contents);
}
