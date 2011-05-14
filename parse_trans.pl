#!/usr/bin/env perl
use strict;
use warnings;
use 5.010;

use Text::CSV;

my $csv = Text::CSV->new;
my $csvout = Text::CSV->new;
$csvout->eol("\n");
my ($file);

for $file (@ARGV) {
    open my $fh, '<', $file or die "Could not open $file: $!";
    
    my @rows;
    while (my $row = $csv->getline($fh)) {
        my @r = @{ $row };
        my ($y, $m, $d);
        if (length($r[0]) > 0) {
            ($y, $m, $d) = $r[0] =~ /^(\d{4})(\d{2})(\d{2})/;
            $d = "01" if $d eq "00";
            $m = "01" if $m eq "00";
            $r[0] = "$y-$m-$d";
        }
        if (length($r[3]) > 0) {
            ($y, $m, $d) = $r[3] =~ /^(\d{4})(\d{2})(\d{2})/;
            $d = "01" if $d eq "00";
            $m = "01" if $m eq "00";
            $r[3] = "$y-$m-$d";
        }

        $r[2] = "true" if $r[2] eq "@";
        $r[4] = "true" if $r[4] eq "@";

        # Rearrange columns some and insert a new one for bbrefid.
        @r = ($r[5], @r[0..4,6], "", @r[7..$#r]);

        push @rows, \@r;
    }
    close $fh;

    $csvout->print(*STDOUT, $_) for @rows;
}
