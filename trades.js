var trades = {
    transactions: [],
    players:      [],
    loaded:       0
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

    load_players();
    load_transactions();
}

function load_players() {
}

function load_transactions() {
}
