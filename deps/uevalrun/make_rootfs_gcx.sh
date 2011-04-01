#! /bin/bash --
#
# make_rootfs_gcx.sh: Create root filesystem for uevalrun UML guests with gcc
# by pts@fazekas.hu at Sat Nov 27 14:01:38 CET 2010
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

test "${0%/*}" != "$0" && cd "${0%/*}"

# Make sure we fail unless weuse ./busybox for all non-built-in commands.
export PATH=/dev/null

test -f busybox

PACKAGES='gcxbase gcc gxx'

FILES=
for P in $PACKAGES; do
  FILES="$FILES $P.stbx86.tbz2"
done

./download.sh $FILES

# This estimate is based on the total size of $PACKAGES extracted, plus busybox etc.
MINIX_KB=56000

./busybox rm -f uevalrun.rootfs.gcx.minix.img  # Make sure it's not mounted.
./busybox dd if=/dev/zero of=uevalrun.rootfs.gcx.minix.img bs=${MINIX_KB}K count=1
# Increase `-i 100' here to increase the file size limit if you get a
# `No space left on device' when running this script.
./busybox mkfs.minix -n 30 -i 2200 uevalrun.rootfs.gcx.minix.img


for P in $PACKAGES; do
  F="$P.stbx86.tbz2"
  test -s "$F"
  ./busybox cat >mkrootgcxpkg.tmp.sh <<ENDMKROOT
#! /bin/sh
set -ex
: Extracting $P
(cd /fs && tar xjf /dev/ubdd) || exit "\$?"
/sbin/minihalt
ENDMKROOT
./uevalrun.linux.uml con=null ssl=null con0=fd:-1,fd:1 mem=10M \
    ubda=uevalrun.rootfs.mini.minix.img ubdb=uevalrun.rootfs.gcx.minix.img \
    ubdc=mkrootgcxpkg.tmp.sh ubdd="$F" init=/sbin/minihalt \
    </dev/null
done
./busybox rm -f mkrootgcxpkg.tmp.sh

./busybox tar cvf mkrootgcx.tmp.tar busybox
./busybox cat >mkrootgcx.tmp.sh <<'ENDMKROOT'
#! /bin/sh
# Don't autorun /sbin/minihalt, so we'll get a kernel panic in the UML guest,
# thus we'll get a nonzero exit code in the UML host if this script fails.
#trap /sbin/minihalt EXIT
set -ex
echo "Hello, World!"
echo 
#ls /proc  # Works.
mkdir -p /fs/bin
mkdir /fs/dev /fs/sbin /fs/proc /fs/etc /fs/fs
mkdir /fs/etc/init.d
cat >/fs/etc/init.d/rcS <<'END'
#! /bin/sh
/bin/mount proc /proc -t proc
END
chmod +x /fs/etc/init.d/rcS
ln -s /fs /fs/tmp
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

(cd /fs && tar xf /dev/ubdd) || exit "$?"  # creates /fs/busybox
mv /fs/busybox /fs/bin/busybox
cp /sbin/minihalt /fs/sbin/minihalt
# TODO(pts): Get
(echo '#include <stdio.h>'; echo 'int main() { return printf("HIX\n"); }') >/fs/hello.c
(echo '#include <iostream>'; echo 'using namespace std;'; echo 'int main() { cout << "HIX" << endl; }') >/fs/hello.cc
# ln -s wouldn't work, gcc tries to find itself based on its argv[0].
#ln -s ../compact-compiler-i686/bin/i686-gcc fs/bin/gcc
cat >fs/bin/gcc <<'END'
#! /bin/sh
export PATH=/
set -ex
exec /bin/i686-gcc -static "$@"
END
chmod +x fs/bin/gcc
cat >fs/bin/g++ <<'END'
#! /bin/sh
export PATH=/
set -ex
exec /bin/i686-g++ -static "$@"
END
chmod +x fs/bin/g++
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

/fs/bin/busybox df
: guest-creator script OK, halting.
/sbin/minihalt
ENDMKROOT

./uevalrun.linux.uml con=null ssl=null con0=fd:-1,fd:1 mem=10M \
    ubda=uevalrun.rootfs.mini.minix.img ubdb=uevalrun.rootfs.gcx.minix.img \
    ubdc=mkrootgcx.tmp.sh ubdd=mkrootgcx.tmp.tar init=/sbin/minihalt \
    </dev/null
./busybox rm -f mkrootgcx.tmp.sh mkrootgcx.tmp.tar

: make_rootfs_gcx.sh OK.
