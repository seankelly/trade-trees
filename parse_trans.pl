#!/usr/bin/env perl
use strict;
use warnings;
use 5.010;

use JSON::Any;
use Text::CSV;

die "Usage: $0 tran.txt Master.txt\n" unless @ARGV == 2;

my $csv = Text::CSV->new;
my $json = JSON::Any->new;
my %players;
my %transactions;

open my $retro_transactions, '<', $ARGV[0] or die "Could not open $ARGV[0]: $!";
open my $bdb_master, '<', $ARGV[1] or die "Could not open $ARGV[1]: $!";

my @r;
my $row;
# Load BDB players first. What I want is the bbref ID, the player's
# first name, last name, and full name.
$row = $csv->getline($bdb_master);
# Only do the column check once.
die "BDB Master file not detected.\n" unless @{ $row } == 33;
do {
    @r = @{ $row };
    # Column 29 = retroid
    # Column 33 = bbrefid
    # Column 16,17 = first and last name
    # Column 19 = given name
    my ($retroid, $bbrefid, $first, $last) = @r[29, 33, 16, 17];
    $players{$retroid} = {
        first   => $first,
        last    => $last,
        given   => $first . ' ' . $last,
        bbrefid => $bbrefid,
        retroid => $retroid,
    };
} while ($row = $csv->getline($bdb_master));
close $bdb_master;

# Now load the transactions list from Retrosheet.
$row = $csv->getline($retro_transactions);
die "Retrosheet transactions fine not detected.\n" unless @{ $row } == 16;
do {
    @r = @{ $row };
    my ($y, $m, $d);
    # Primary date.
    if (length($r[0]) > 0) {
        ($y, $m, $d) = $r[0] =~ /^(\d{4})(\d{2})(\d{2})/;
        $d = "01" if $d eq "00";
        $m = "01" if $m eq "00";
        $r[0] = "$y-$m-$d";
    }
    # Secondary date.
    if (length($r[3]) > 0) {
        ($y, $m, $d) = $r[3] =~ /^(\d{4})(\d{2})(\d{2})/;
        $d = "01" if $d eq "00";
        $m = "01" if $m eq "00";
        $r[3] = "$y-$m-$d";
    }

    # Fields 2 or 4 are '@' if the primary date or secondary date,
    # respectively, are approximate. Convert the machine unfriendly @ to
    # the machine friendly 'true'.
    $r[2] = "true" if $r[2] eq "@";
    $r[4] = "true" if $r[4] eq "@";

    $r[7] =~ s/\s+//g;

    # Get the Baseball Reference ID.
    # It's easier to link to the B-R page to allow quick
    # cross-referencing the trade tree.
    my $bbrefid = $players{$r[6]}
                ? $players{$r[6]}->{bbrefid}
                : $r[6];

    # Rearrange columns some and insert a new one for bbrefid.
    # Column 0: Primary date.
    #  1: Time
    #  2: Approximate indicator for primary date.
    #  3: Secondary date
    #  3: Approximate indicator for secondary date.
    #  5: Transaction ID
    #  6: Retrosheet ID
    #  7: Transaction type
    #  8: From team
    #  9: From league
    # 10: To team
    # 11: To league
    # 12: Draft type
    # 13: Draft round
    # 14: Pick number
    # 15: Info
    my $id = $r[5];
    my $trade_info = {
        date   => $r[0],
        type   => $r[7],
        player => $bbrefid,
        from   => $r[8],
        to     => $r[10],
        info   => $r[15],
    };

    if (!$transactions{$id}) {
        $transactions{$id} = [ $trade_info ];
    }
    else {
        push @{ $transactions{$id} }, $trade_info;
    }
} while ($row = $csv->getline($retro_transactions));
close $retro_transactions;

open my $file, '>', 'transactions.json' or die "Couldn't open transactions.json: $!";
print $file $json->to_json(\%transactions);
close $file;
