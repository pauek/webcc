#! /bin/bash --
#
# examples/run.sh: Run uevalrun with some preconfigured settings.
# by pts@fazekas.hu at Sun Nov 28 13:17:28 CET 2010
#
# This program is free software; you can redistribute it and/or modify   
# it under the terms of the GNU General Public License as published by
# the Free Software Foundation; either version 2 of the License, or
# (at your option) any later version.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU General Public License for more details.
set -ex
# Make sure we fail unless weuse ./busybox for all non-built-in commands.
export PATH=/dev/null
test "${0%/*}" != "$0" && cd "${0%/*}"
../make -C ..
if test "$1" = python; then
  ../uevalrun -M 32 -T 3 -E 20 -s scat.py -t answer.in -e answer.exp
elif test "$1" = ruby; then
  ../uevalrun -M 32 -T 3 -E 20 -s scat.rb -t answer.in -e answer.exp
elif test "$1" = php; then
  ../uevalrun -M 32 -T 3 -E 20 -s scat.php -t answer.in -e answer.exp
elif test "$1" = perl; then
  ../uevalrun -M 32 -T 3 -E 20 -s scat.pl -t answer.in -e answer.exp
elif test "$1" = lua; then
  ../uevalrun -M 32 -T 3 -E 20 -s scat.lua -t answer.in -e answer.exp
elif test "$1" = javascript; then
  ../uevalrun -M 32 -T 3 -E 20 -s scat.js -t answer.in -e answer.exp
elif test "$1" = perl.ok; then
  ../uevalrun -M 32 -T 3 -E 20 -s scatok.pl -t answer.in -e answer.exp
elif test "$1" = c; then
  ../uevalrun -M 3 -T 9 -E 20 -s scatc   -C 2 -N 32 -U 10 -t answer.in -e answer.scatc.exp
elif test "$1" = gcc; then
  ../uevalrun -M 3 -T 9 -E 20 -s scat.c  -C 2 -N 32 -U 10 -t answer.in -e answer.exp
elif test "$1" = gxx; then
  ../uevalrun -M 3 -T 9 -E 20 -s scat.cc -C 2 -N 32 -U 20 -t answer.in -e answer.exp
elif test "$1" = long; then
  perl scatlong.pl >long.exp  # TODO(pts): Do this without Perl.
  ../uevalrun -M 32 -T 3 -E 20 -s scatlong.pl -t answer.in -e long.exp
elif test "$#" = 1; then
  ../make -C .. xcat
  ../uevalrun -M 26 -T 3 -E 20 -s ../xcat -t answer.in -e answer.bad.exp
else
  ../make -C .. xcat
  ../uevalrun -M 26 -T 3 -E 20 -s ../xcat -t answer.in -e answer.exp
fi
