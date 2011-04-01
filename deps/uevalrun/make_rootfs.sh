#! /bin/bash --
#
# make_rootfs.sh: Create the root filesystem for uevalrun UML guests
# by pts@fazekas.hu at Sat Nov 20 16:42:03 CET 2010
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
#
set -ex

test "${0%/*}" != "$0" && cd "${0%/*}"

# Make sure we fail unless weuse ./busybox for all non-built-in commands.
export PATH=/dev/null

test -f busybox
# TODO(pts): Make it configurable so some of these won't be needed.
DPROGS="perl5.10 php5.3 ruby1.8 ruby1.9 stackless2.7 luajit1.1 smjs1.8"
./busybox sh ./download.sh $DPROGS
PROGS="$DPROGS busybox"
PROGS_KB=$(./busybox ls -l $PROGS | ./busybox awk '{s+=(($5+1023)/1024)}END{printf"%d\n",s}')
test "$PROGS_KB"
# TODO(pts): Give a better estimate.
let MINIX_KB=12+PROGS_KB+PROGS_KB/256

./busybox rm -f uevalrun.rootfs.minix.img  # Make sure it's not mounted.
./busybox dd if=/dev/zero of=uevalrun.rootfs.minix.img bs=${MINIX_KB}K count=1
# Increase `-i 100' here to increase the file size limit if you get a
# `No space left on device' when running this script.
./busybox mkfs.minix -n 14 -i 115 uevalrun.rootfs.minix.img

./busybox tar cvf mkroot.tmp.tar $PROGS
./busybox cat >mkroot.tmp.sh <<'ENDMKROOT'
#! /bin/sh
# Don't autorun /sbin/minihalt, so we'll get a kernel panic in the UML guest,
# thus we'll get a nonzero exit code in the UML host if this script fails.
#trap /sbin/minihalt EXIT
set -ex
echo "Hello, World!"
#ls /proc  # Works.

mkdir /fs/dev /fs/bin /fs/sbin /fs/proc /fs/etc
mkdir /fs/etc/init.d
cat >/fs/etc/init.d/rcS <<'END'
#! /bin/sh
/bin/mount proc /proc -t proc
END
chmod +x /fs/etc/init.d/rcS
cp -a /dev/console /fs/dev/
cp -a /dev/ttyS0 /fs/dev/
cp -a /dev/ttyS1 /fs/dev/
cp -a /dev/tty0 /fs/dev/
cp -a /dev/tty1 /fs/dev/
cp -a /dev/tty2 /fs/dev/
cp -a /dev/tty3 /fs/dev/
cp -a /dev/tty4 /fs/dev/
cp -a /dev/null /fs/dev/
cp -a /dev/zero /fs/dev/
mknod /fs/dev/ubdb b 98 16
mknod /fs/dev/ubdc b 98 32
mknod /fs/dev/ubdd b 98 48
mknod /fs/dev/ubde b 98 64
# Grant read permission for the user: it migh be a script.
chmod 755 /fs/dev/ubdb
chmod 600 /fs/dev/ubdc
chmod 700 /fs/dev/ubdd
chmod 600 /fs/dev/ubde
mknod /fs/dev/random c 1 8
chmod 666 /fs/dev/random
mknod /fs/dev/urandom c 1 9
chmod 666 /fs/dev/urandom

(cd /fs && tar xf /dev/ubdd) || exit "$?"  # creates /fs/busybox /fs/ruby1.8
chmod 755 /fs/perl5.10 /fs/php5.3 /fs/ruby1.8 /fs/ruby1.9 /fs/stackless2.7 /fs/luajit1.1 /fs/smjs1.8 /fs/busybox
mv /fs/ruby1.8 /fs/bin/ruby1.8
ln -s ruby1.8 /fs/bin/ruby
mv /fs/ruby1.9 /fs/bin/ruby1.9
mv /fs/php5.3 /fs/bin/php
mv /fs/perl5.10 /fs/bin/perl
mv /fs/luajit1.1 /fs/bin/luajit1.1
ln -s luajit1.1 /fs/bin/luajit
ln -s luajit1.1 /fs/bin/lua
mv /fs/smjs1.8 /fs/bin/smjs1.8
ln -s smjs1.8 /fs/bin/smjs
ln -s smjs1.8 /fs/bin/js
mv /fs/stackless2.7 /fs/bin/stackless2.7
ln -s stackless2.7 /fs/bin/python
ln -s stackless2.7 /fs/bin/stackless
mv /fs/busybox /fs/bin/busybox
# cp hello bincat /fs/bin  # Custom binaries.
ln -s ../bin/busybox /fs/sbin/init
ln -s ../bin/busybox /fs/sbin/halt
ln -s ../bin/busybox /fs/sbin/reboot
ln -s ../bin/busybox /fs/sbin/swapoff
ln -s ../bin/busybox /fs/bin/mount
ln -s ../bin/busybox /fs/bin/umount
ln -s ../bin/busybox /fs/bin/sh
ln -s ../bin/busybox /fs/bin/ls
ln -s ../bin/busybox /fs/bin/mkdir
ln -s ../bin/busybox /fs/bin/rmdir
ln -s ../bin/busybox /fs/bin/cp
ln -s ../bin/busybox /fs/bin/mv
ln -s ../bin/busybox /fs/bin/rm
ln -s ../bin/busybox /fs/bin/du
ln -s ../bin/busybox /fs/bin/df
ln -s ../bin/busybox /fs/bin/awk
ln -s ../bin/busybox /fs/bin/sed
ln -s ../bin/busybox /fs/bin/cat
ln -s ../bin/busybox /fs/bin/vi
ln -s ../bin/busybox /fs/bin/stty

: guest-creator script OK, halting.
/sbin/minihalt
ENDMKROOT

# Use the minix driver in uevalrun.linux.uml to populate our rootfs
# (uevalrun.rootfs.minix.img).
./uevalrun.linux.uml con=null ssl=null con0=fd:-1,fd:1 mem=10M \
    ubda=uevalrun.rootfs.mini.minix.img ubdb=uevalrun.rootfs.minix.img \
    ubdc=mkroot.tmp.sh ubdd=mkroot.tmp.tar init=/sbin/minihalt \
    </dev/null
./busybox rm -f mkroot.tmp.sh mkroot.tmp.tar

: make_rootfs.sh OK.
