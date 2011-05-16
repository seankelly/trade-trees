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
    my ($retroid, $bbrefid, $first, $last, $given) = @r[29, 33, 16, 17, 19];
    $players{$retroid} = {
        first   => $first,
        last    => $last,
        given   => $given,
        bbrefid => $bbrefid,
        retroid => $retroid,
    };
} while ($row = $csv->getline($bdb_master));

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

    # Rearrange columns some and insert a new one for bbrefid.
    @r = ($r[5], @r[0..4,6], "", @r[7..$#r]);

#    push @rows, \@r;
} while ($row = $csv->getline($retro_transactions));

close $retro_transactions;
close $bdb_master;
