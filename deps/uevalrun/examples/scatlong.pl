#! /usr/bin/perl
print(("x" x 1000 . "\n") x 200);
print "END\n";
close STDOUT;
print STDERR "Everything is fine!\n";

