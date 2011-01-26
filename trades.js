var trades = {
    transactions: [],
    players:      [],
    loaded: false,
    tree: {}
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

// Returns all of the transaction types for a player in
// the transaction. This is because there are some multi-
// transaction events (e.g. rule 5 draftee gets returned),
// so let the calling function sort it out.
Transaction.prototype.get_transaction_types = function(playerid) {
    // First find the player.
    if (!this.players[playerid])
        return [];

    var types = [];
    var player = this.players[playerid];
    for (var i = 0; i < player.length; i++) {
        types.push({
            'type': player[i].type,
            'from': player[i].from,
            'to': player[i].to
        });
    }

    return types;
}

// Get the team for the player in the transaction.
Transaction.prototype.get_player_team = function(playerid) {
    if (!this.players[playerid])
        return '';

    var player = this.players[playerid];
    if (player.length != 1) return '';
    return player[0].from;
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
    get_players(playerid, function() { show_transactions(playerid); });
}

function choose_transaction(option) {
    var trans_id = option.value;
    var playerid = $("#player").val();

    // Reset the trade tree, and set the traded player
    // as its root.
    var tree = {
        'stack': [],
        'root': playerid,
    };
    tree[playerid] = {
        // This is the actual transaction involved in the trade.
        '_transaction': trans_id,
        // This is the player's originating transaction.
        // Don't need to record anything for the root player, since
        // we already know when he leaves.
        '_start_transaction': 0,
        // This isn't strictly necessary for the root player, but
        // I'm putting it here for documentation purposes.
        '_playerid': playerid
    };
    tree.stack.push(tree[playerid]);
    trades.tree = tree;

    // Get all of the players in the trade.
    // This is a bit redundant with some code in trade_iteration,
    // but haven't yet figured out how to merge the two.
    var p = Transaction.load(trans_id).trade_return(playerid);
    var players = [];
    for (var i = 0; i < p.length; i++)
        if (typeof p[i] != 'object')
            players.push(p[i]);

    get_players(players, trade_iteration);
}

// This runs for every iteration of the BFS (or DFS).
function trade_iteration() {
    // Fetch all players associated with the transaction
    // for the references in tree.stack.
    var tree = trades.tree;
    var stack = trades.tree.stack;
    var new_stack = [];
    // Use an object to ensure each player is only present once.
    var players_to_get = {};
    while (stack.length > 0) {
        var ref = stack.shift();
        var T = Transaction.load(ref._transaction);
        // Get the players returning to the team.
        var p = T.trade_return(ref._playerid);
        // And the team of the traded away player.
        var team = T.get_player_team(ref._playerid);
        for (var i = 0; i < p.length; i++) {
            // Add each player to the list of to-fetch players.
            var id = p[i];
            if (typeof id != 'object') {
                new_players.push(id);
            }
            else {
                id = 'other';
            }
            // Also add the player to the tree.
            ref[id] = {
                '_start_transaction': ref._transaction
            }

            // Now figure out what happened to the player.
            if (id == 'other') continue;

            var result = player_result(id, team, T.id);
            // Load the outgoing transaction.
            var out_T = Transaction.load(result[1]);

            // See if the team got anything back from trading him.
            var trade_result = out_T.trade_return(id);
            // And add them.
            // The if is used only to add a reference to the
            // (new!!) stack of players to parse.
            if (trade_result.length > 0) {
                new_stack.push(ref[id]);
                for (var j = 0; j < trade_result.length; j++) {
                    // Check for the other that could be returned.
                    if (typeof trade_result[j] != 'object')
                        players_to_get[trade_result[j]] = true;
                }
            }
        }
    }

    var new_players = [];
    for (var p in players_to_get) {
        if (players_to_get.hasOwnProperty(p))
            new_players.push(p);
    }

    // Finally, if there are any players to fetch, do another
    // iteration of the trade tree.
    if (new_players.length > 0) {
    }
    else {
        // All done, sweet!
    }
}

// This will determine what happens to the player AFTER
// the given transaction, such as traded again, free agent,
// release, etc.
function player_result(playerid, team, transid) {
    // Find the transaction.
    var transactions = trades.players[playerid].transactions;
    for (var i = 0; i < transactions.length; i++) {
        if (transid == transactions[i])
            break;
    }

    // Uh oh, either couldn't find it or it was the last
    // transaction available. Assume he was released.
    if (i >= transactions.length)
        return 'unknown';

    // Now have to find when the player leaves, and return
    // the result and the transaction id IF it's a trade.
    var player_left = false;
    // This is to check for if a player is returned.
    var possibly_left = false;
    var check_possibly_left = { 'D': true, 'L': true, 'T': true };
    var check_returned = { 'Dr': true, 'Lr': true, 'Tr': true, 'Tn': true, 'Tv': true };
    var check_outright_left = { 'Fg': true, 'R': true, 'Tp': true, 'W': true, 'X': true };
    var new_trans_id;
    for (i++; i < transactions.length; i++) {
        var T = Transaction.load(transactions[i]);
        var types = T.get_transaction_types(playerid);
        for (var j = 0; j < types.length; j++) {
            var type = types[j].type,
                from = types[j].from,
                to   = types[j].to;
            // This is the only time the from team can be different.
            if (possibly_left) {
                // But the to team must be the same as the originating team.
                if (to == team && check_returned[type]) {
                    // Keep going, he didn't actually leave.
                    possibly_left = false;
                    new_trans_id = '';
                }
                else {
                    return [ type_to_text(type), new_trans_id ];
                }
            }
            else if (from == team) {
                if (check_outright_left[type]) {
                    return [ type_to_text(type), T.id ];
                }
                else if (check_possibly_left[type]) {
                    possibly_left = true;
                    new_trans_id = transactions[i];
                }
            }
            else {
                // Uh oh, shouldn't be here.
                // Either missed a case, or the data is wrong.
                // Assume released!
                return [ 'unknown', '' ];
            }
        }
    }

    // Shouldn't reach the end of the function, but just in case
    // return an unknown trade.
    return [ 'unknown', '' ];
}

function type_to_text(type) {
    var text = {
        'A':   'assigned',
        'C':   'conditional deal',
        'Cr':  'conditional deal return',
        'D':   'rule 5 draft pick',
        'Da':  'amateur draft pick',
        'Df':  'first year draft pick',
        'Dm':  'minor league draft pick',
        'Dn':  'did not sign in amateur draft',
        'Dr':  'draft selection return',
        'Ds':  'special draft pick',
        'Dv':  'amateur draft pick voided',
        'F':   'free agent signing',
        'Fa':  'amateur free agent signing',
        'Fb':  'bonus baby',
        'Fc':  'free agent compensation pick',
        'Fg':  'free agent granted',
        'Fo':  'free agent signing with first ML team',
        'Fv':  'free agent signing voided',
        'Hb':  'went on the bereavement list',
        'Hbr': 'came off the bereavement list',
        'Hd':  'declared ineligible',
        'Hdr': 'reinistated from the ineligible list',
        'Hf':  'demoted to the minor league',
        'Hfr': 'promoted from the minor league',
        'Hh':  'held out',
        'Hhr': 'ended hold out',
        'Hi':  'went on the disabled list',
        'Hir': 'came off the disabled list',
        'Hm':  'went into military service',
        'Hmr': 'returned from military service',
        'Hs':  'suspended',
        'Hsr': 'reinstated after suspension',
        'Hu':  'unavailable but not on DL',
        'Hur': 'returned from being unavailable',
        'Hv':  'voluntarity retired',
        'Hvr': 'unretired',
        'J':   'jumped teams',
        'Jr':  'returned after jumping',
        'L':   'loaned to another team',
        'Lr':  'returned after loan',
        'M':   'obtained rights when entering into working agreement with minor league team',
        'Mr':  'rights returned when working agreement with minor league team ended',
        'P':   'purchased',
        'Pr':  'returned after purchase',
        'Pv':  'purchase voided',
        'R':   'released',
        'T':   'traded',
        'Tn':  'traded but refused to report',
        'Tp':  'added to trade',
        'Tr':  'returned after trade',
        'Tv':  'trade voided',
        'U':   'unknown',
        'Vg':  'player assigned to league control',
        'V':   'player purchased or assigned to team from league',
        'W':   'waiver pick',
        'Wf':  'first year waiver pick',
        'Wr':  'returned after waiver pick',
        'Wv':  'waiver pick voided',
        'X':   'expansion draft',
        'Xp':  'added as expansion pick at a later date',
        'Z':   'voluntarily retired',
        'Zr':  'returned from voluntarily retired list'
    };

    return text[type];
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
function get_players(playerids, func) {
    var players = [];
    var urls = [];
    // Allow passing an array..
    if (playerids instanceof Array) {
        for (var i = 0; i < playerids.length; i++) {
            if (trades.players[playerids[i]].transactions) continue;
            players.push(playerids[i]);
        }
    }
    // ..or a string instead.
    else if (typeof playerids == 'string') {
        if (trades.players[playerids].transactions) return;
        players.push(playerids);
    }
    // Otherwise just return. Maybe throw an error?
    else
        return;

    // Make sure there's something to even fetch!
    if (players.length == 0) return;
    for (var i = 0; i < players.length; i++)
        urls.push('json/' + players[i] + '.json');

    get_files(urls,
        // This one is called at the very end.
        function() {
            get_player_transactions(players, func);
        },
        // Called for every player (obviously).
        function(data) {
            trades.players[this.file].transactions = data;
        }
    );
}

function get_player_transactions(playerids, func) {
    // Must pass an array!
    if (!(playerids instanceof Array)) throw new TypeError();

    var urls = [];
    for (var i = 0; i < playerids.length; i++) {
        var transactions = trades.players[playerids[i]].transactions;
        for (var j = 0; j < transactions.length; j++) {
            // Only get the ones that haven't been fetched yet.
            if (!Transaction.load(transactions[j]))
                urls.push('json/' + transactions[j] + '.json');
        }
    }

    get_files(urls,
        function() {
            // Finally func gets called!
            func();
        },
        function(data) {
            var id = this.file;
            trades.transactions[id] = new Transaction(id, data);
        }
    );
}

/*
 * Downloading functions.
 */

// get_files does just what its name suggests, it will get
// every file given to it and run func() only once ALL of
// the files have been fetched.
function get_files(files, finish_func, each_func, error_func) {
    var empty_function = function() {}
    if (!(files instanceof Array)) return;
    if (typeof finish_func != 'function') finish_func = empty_function;
    if (typeof each_func != 'function') each_func = empty_function;
    if (typeof error_func != 'function') error_func = show_error;

    // Create a closure to get a private variable to keep
    // track how many times it's been called.
    var closure = (function(number_expected) {
        var number_loaded = 0;
        return function(data) {
            number_loaded++;
            this.each_func(data);
            if (number_loaded < number_expected) return;
            this.finish_func();
        }
    });

    var f = closure(files.length);
    for (var i = 0; i < files.length; i++) {
        $.ajax({
            context: {
                'finish_func': finish_func,
                'each_func': each_func,
                'url': files[i],
                'file': file_part(files[i])
            },
            url: files[i],
            dataType: 'json',
            success: f,
            error: error_func
        });
    }
}

function file_part(filename) {
    var start = filename.lastIndexOf('/');
    var end = filename.indexOf('.', start);
    if (end == -1) end = filename.length;
    return filename.slice(start + 1, end);
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
                desc: T.format(playerid)
            });
        }
    }

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
