#!/usr/bin/env perl
use strict;
use warnings;
use 5.010;

use Text::CSV;
use JSON::Any;
use DDS;

my $csv = Text::CSV->new;
my $json = JSON::Any->new;
my (%transactions, %players, %players_full);

for my $file (@ARGV) {
    open my $fh, '<', $file or die "Could not open $file: $!";
    my $obj;

    while (my $row = $csv->getline($fh)) {
        my @r = @{ $row };

        # transaction_id, primary_date, bbrefid, name, type,
        # from_team, from_league, to_team, to_league, draft_round, info
        my ($id, $date, $playerid, $player_name, $first_name, $last_name, $type,
            $from_team, $from_league, $to_team, $to_league, $round, $info) = @r;
        $type =~ s/\s+$//;
        if ($transactions{$id}) {
            push @{ $transactions{$id} }, {
                player => $playerid,
                date   => $date,
                type   => $type,
                info   => $info,
                from   => $from_team,
                to     => $to_team,
            };
        }
        else {
            $transactions{$id} = [
                {
                    player => $playerid,
                    date   => $date,
                    type   => $type,
                    info   => $info,
                    from   => $from_team,
                    to     => $to_team,
                }
            ];
        }

        if ($players_full{$playerid}) {
            push @{ $players_full{$playerid} }, $id;
        }
        elsif ($playerid ne '') {
            $players_full{$playerid} = [ $id ];
            $players{$playerid} = {
                name         => $player_name,
                first        => $first_name,
                last         => $last_name,
            };
        }
    }

    close $fh;
}

my ($key, $file);
for $key (keys %transactions) {
    open $file, '>', "$key.json" or die "Could not open $key.json: $!";
    print $file $json->to_json($transactions{$key});
    close $file;
}

for $key (keys %players_full) {
    open $file, '>', "$key.json" or die "Could not open $key.json: $!";
    print $file $json->to_json($players_full{$key});
    close $file;
}
open $file, '>', "players.json" or die "Could not open players.json: $!";
print $file $json->to_json(\%players);
close $file;
