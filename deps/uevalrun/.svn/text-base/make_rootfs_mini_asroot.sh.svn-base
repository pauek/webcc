#! /bin/bash --
#
# make_root_fs_mini.sh: create the mini filesystem as root on the host
# by pts@fazekas.hu at Wed Nov 24 02:04:14 CET 2010
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
#
# The mini filesystem is used for bootstrapping the real filesystem creation.
#
# Creating the mini filesystem needs root privileges, but then it can be
# redistributed as a filesystem image.
#
# See make_rootfs_mini.sh which uses the redistributed mini filesystem image
# to make the mini filesystem.

set -ex

test "${0%/*}" != "$0" && cd "${0%/*}"

# Make sure we fail unless weuse ./busybox for all non-built-in commands.
export PATH=/dev/null

test -f busybox
BUSYBOX_KB=$(./busybox ls -l busybox.mini | ./busybox awk '{printf "%d", (($5+1024)/1024)}')
test "$BUSYBOX_KB"
let MINIX_KB=60+BUSYBOX_KB

./busybox rm -f uevalrun.rootfs.mini.minix.img  # Make sure it's not mounted.
./busybox dd if=/dev/zero of=uevalrun.rootfs.mini.minix.img bs=${MINIX_KB}K count=1
./busybox chmod 644 uevalrun.rootfs.mini.minix.img
test "$SUDO_USER" && ./busybox chown "$SUDO_USER" uevalrun.rootfs.mini.minix.img || /bin/chown "$SUDO_USER" uevalrun.rootfs.mini.minix.img
# Increase `-i 40' here to increase the file size limit if you get a
# `No space left on device' when running this script.
./busybox mkfs.minix -n 14 -i 40 uevalrun.rootfs.mini.minix.img

# In ./busybox sh, "$EUID" is 0.
test -z "$EUID" || test "$EUID" = 0
./busybox modprobe minix || true
./busybox umount rp || true
./busybox rm -rf rp
./busybox mkdir -p rp
./busybox mount -o loop uevalrun.rootfs.mini.minix.img rp
./busybox mkdir rp/dev rp/bin rp/sbin rp/proc rp/fs
./busybox ln -s minihalt rp/sbin/halt
./busybox cp -a /dev/console rp/dev/
./busybox cp -a /dev/ttyS0 rp/dev/
./busybox cp -a /dev/ttyS1 rp/dev/
./busybox cp -a /dev/tty0 rp/dev/
./busybox cp -a /dev/tty1 rp/dev/
./busybox cp -a /dev/tty2 rp/dev/
./busybox cp -a /dev/tty3 rp/dev/
./busybox cp -a /dev/tty4 rp/dev/
./busybox cp -a /dev/null rp/dev/
./busybox cp -a /dev/zero rp/dev/
./busybox mknod rp/dev/ubdb b 98 16
./busybox mknod rp/dev/ubdc b 98 32
./busybox mknod rp/dev/ubdd b 98 48
./busybox chmod 711 rp/dev/ubdb
./busybox chmod 600 rp/dev/ubdc
./busybox chmod 700 rp/dev/ubdd

./busybox cp busybox.mini rp/bin/busybox
for CMD in \
  [ [[ ash awk cat chgrp chmod chown cmp cp dd echo egrep \
  expr false fgrep grep install ls ln mkdir mkfifo mknod mv \
  pwd readlink realpath rm rmdir sh sync tar  \
  test true uncompress wc xargs yes \
; do
  ./busybox ln -s ../bin/busybox rp/bin/"$CMD"
done

# busybox can't halt without /proc, so we'll use minihalt
#ln -s ../bin/busybox rp/sbin/halt
if test -x minihalt; then
  ./busybox cp minihalt rp/sbin/minihalt
else
  test -x precompiled/minihalt
  ./busybox cp precompiled/minihalt rp/sbin/minihalt
fi

./busybox umount rp
./busybox rmdir rp
: Created uevalrun.rootfs.mini.minix.img
: make_rootfs_mini_asroot.sh OK.
