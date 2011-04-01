#! /bin/bash --
#
# make_root_fs_mini.sh: create the mini filesystem (using itself)
# by pts@fazekas.hu at Wed Nov 24 23:30:45 CET 2010
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
# The mini filesystem is used for bootstrapping the real filesystem creation.
#
# UML + the previous version of the mini filesystem is used to recreate the
# mini filesystem.

set -ex

test "${0%/*}" != "$0" && cd "${0%/*}"

# Make sure we fail unless weuse ./busybox for all non-built-in commands.
export PATH=/dev/null

test -f busybox
BUSYBOX_KB=$(./busybox ls -l busybox.mini | ./busybox awk '{printf "%d", (($5+1024)/1024)}')
test "$BUSYBOX_KB"
let MINIX_KB=60+BUSYBOX_KB

test -f uevalrun.rootfs.mini.minix.img ||
    svn revert uevalrun.rootfs.mini.minix.img
# TODO(pts): Autodetect the compiler, add paths etc.
#./make minihalt ||
test -f minihalt ||
    ./busybox cp precompiled/minihalt minihalt

./busybox rm -f uevalrun.rootfs.newmini.minix.img  # Make sure it's not mounted.
./busybox dd if=/dev/zero of=uevalrun.rootfs.newmini.minix.img bs=${MINIX_KB}K count=1
test "$SUDO_USER" && sudo chown "$SUDO_USER" uevalrun.rootfs.newmini.minix.img
# Increase `-i 40' here to increase the file size limit if you get a
# `No space left on device' when running this script.
./busybox mkfs.minix -n 14 -i 40 uevalrun.rootfs.newmini.minix.img

./busybox tar cvf mkrootmini.tmp.tar busybox.mini minihalt
./busybox cat >mkrootmini.tmp.sh <<'ENDMKROOT'
#! /bin/sh
# Don't autorun /sbin/minihalt, so we'll get a kernel panic in the UML guest,
# thus we'll get a nonzero exit code in the UML host if this script fails.
#trap /sbin/halt EXIT
set -ex
echo "Hello, World!"
#ls /proc  # Works.

mkdir /fs/dev /fs/bin /fs/sbin /fs/proc /fs/fs
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
chmod 711 /fs/dev/ubdb
chmod 600 /fs/dev/ubdc
chmod 700 /fs/dev/ubdd

(cd /fs && tar xf /dev/ubdd) || exit "$?"  # creates /fs/busybox.mini and /fs/minihalt
mv /fs/busybox.mini /fs/bin/busybox
mv /fs/minihalt /fs/sbin/minihalt
ln -s minihalt /fs/sbin/halt
ln -s ../bin/busybox /fs/bin/[
ln -s ../bin/busybox /fs/bin/[[
ln -s ../bin/busybox /fs/bin/ash
ln -s ../bin/busybox /fs/bin/awk
ln -s ../bin/busybox /fs/bin/cat
ln -s ../bin/busybox /fs/bin/chgrp
ln -s ../bin/busybox /fs/bin/chmod
ln -s ../bin/busybox /fs/bin/chown
ln -s ../bin/busybox /fs/bin/cmp
ln -s ../bin/busybox /fs/bin/cp
ln -s ../bin/busybox /fs/bin/dd
ln -s ../bin/busybox /fs/bin/echo
ln -s ../bin/busybox /fs/bin/egrep
ln -s ../bin/busybox /fs/bin/expr
ln -s ../bin/busybox /fs/bin/false
ln -s ../bin/busybox /fs/bin/fgrep
ln -s ../bin/busybox /fs/bin/grep
ln -s ../bin/busybox /fs/bin/install
ln -s ../bin/busybox /fs/bin/ls
ln -s ../bin/busybox /fs/bin/ln
ln -s ../bin/busybox /fs/bin/mkdir
ln -s ../bin/busybox /fs/bin/mkfifo
ln -s ../bin/busybox /fs/bin/mknod
ln -s ../bin/busybox /fs/bin/mv
ln -s ../bin/busybox /fs/bin/pwd
ln -s ../bin/busybox /fs/bin/readlink
ln -s ../bin/busybox /fs/bin/realpath
ln -s ../bin/busybox /fs/bin/rm
ln -s ../bin/busybox /fs/bin/rmdir
ln -s ../bin/busybox /fs/bin/sh
ln -s ../bin/busybox /fs/bin/sync
ln -s ../bin/busybox /fs/bin/tar
ln -s ../bin/busybox /fs/bin/test
ln -s ../bin/busybox /fs/bin/true
ln -s ../bin/busybox /fs/bin/uncompress
ln -s ../bin/busybox /fs/bin/wc
ln -s ../bin/busybox /fs/bin/xargs
ln -s ../bin/busybox /fs/bin/yes

: guest-creator script OK, halting.
/sbin/minihalt
ENDMKROOT

./uevalrun.linux.uml con=null ssl=null con0=fd:-1,fd:1 mem=10M \
    ubda=uevalrun.rootfs.mini.minix.img \
    ubdb=uevalrun.rootfs.newmini.minix.img \
    ubdc=mkrootmini.tmp.sh ubdd=mkrootmini.tmp.tar init=/sbin/minihalt \
    </dev/null
./busybox rm -f mkrootmini.tmp.sh mkrootmini.tmp.tar
./busybox mv -f uevalrun.rootfs.newmini.minix.img uevalrun.rootfs.mini.minix.img

: make_rootfs_mini.sh OK.
