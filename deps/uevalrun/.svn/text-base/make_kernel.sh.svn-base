#! /bin/bash --
#
# make_kernel.sh: build the uevalrun.linux.uml kernel
# by pts@fazekas.hu at Wed Nov 24 00:26:59 CET 2010
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

KERNEL_TBZ2="${KERNEL_TBZ2:-linux-2.6.36.1.tar.bz2}"

./busybox sh ./download.sh "$KERNEL_TBZ2" gcxbase.stbx86.tbz2 gcc.stbx86.tbz2 gcctool.stbx86.tbz2 gcxtool.stbx86.tbz2

./busybox rm -rf make_kernel.tmp
./busybox mkdir make_kernel.tmp

./busybox mkdir make_kernel.tmp/cross-compiler
for P in gcxbase gcc gcctool gcxtool; do
  : Extracting "$P"
  (cd make_kernel.tmp/cross-compiler && ../../busybox tar xj) <"$P.stbx86.tbz2" || exit "$?"
done

: Extracting "$KERNEL_TBZ2"
(cd make_kernel.tmp && ../busybox tar xj) <"$KERNEL_TBZ2" || exit "$?"
./busybox mv make_kernel.tmp/linux-* make_kernel.tmp/kernel
: Applying linux-2.6.36-uevalrun.patch
# TODO(pts): Make ``busybox patch'' not talk to the user.
(cd make_kernel.tmp/kernel && ../../busybox patch -p1) <linux-2.6.36-uevalrun.patch || exit "$?"

# Make sure that /bin/sh and /bin/bash is not run during the compilation.
# Please note that there are some scripts which use /usr/bin/perl, but they
# are not needed (except for kernel/timeconst.h in kernel/Makefile, but
# the patch above takes care of that). Also /usr/bin/python is used by some
# scripts, but that's not needed either.
export SHELLX="$PWD/make_kernel.tmp/bin/sh"
for F in make_kernel.tmp/kernel/scripts/* \
         make_kernel.tmp/kernel/scripts/kconfig/* \
         make_kernel.tmp/kernel/scripts/kconfig/lxdialog/* \
         make_kernel.tmp/arch/sh/boot/compressed/install.sh \
         make_kernel.tmp/arch/x86/boot/install.sh \
         make_kernel.tmp/arch/x86/vdso/checkundef.sh \
; do
  test -f "$F" || continue
  ./busybox awk '{sub(/^#! *\/bin\/(ba)?sh/,"#!"ENVIRON["SHELLX"]);
                  sub(/^#! .*\/perl/,"#!/dev/null/missing/perl");
                  sub(/^#! .*\/python/,"#!/dev/null/missing/python");
                  print}' \
      <"$F" >make_kernel.tmp/out
  ./busybox cat make_kernel.tmp/out >"$F"
done

./busybox mkdir make_kernel.tmp/bin
./busybox cp busybox make make_kernel.tmp/bin/
for F in cat cmp cp cut date echo expr grep hostname mkdir mv rm \
         sed sh tail uname wc whoami \
; do
  ./busybox ln -s busybox make_kernel.tmp/bin/"$F"
done         

# TODO(pts): Auto-detect non-i686 prefixes.
CROSS="$PWD/make_kernel.tmp/cross-compiler/bin/i686-"
test "${CROSS}gcc"

( unset LANG LANGUAGE LC_ALL LC_CTYPE LC_MONETARY LC_TIME LC_NUMERIC \
  LC_COLLATE LC_MESSAGES LC_PAPER LC_NAME LC_ADDRESS LC_TELEPHONE \
  LC_MEASUREMENT LC_IDENTIFICATION
  export SHELL="$PWD/make_kernel.tmp/bin/sh"
  export PATH="$PWD/make_kernel.tmp/bin"
  cd make_kernel.tmp/kernel &&
     SHELL="$SHELL" PATH="$PATH" \
     make \
     ARCH=um \
     CROSS_COMPILE="$CROSS" \
     HOSTCC="${CROSS}gcc -static" \
     LD_XFLAGS=-static \
     vmlinux)
./busybox ls -l  make_kernel.tmp/kernel/vmlinux
${CROSS}strip    make_kernel.tmp/kernel/vmlinux
./busybox ls -l  make_kernel.tmp/kernel/vmlinux
./busybox rm -f uevalrun.linux.uml.tmp
./busybox cp make_kernel.tmp/kernel/vmlinux uevalrun.linux.uml.tmp
./busybox mv uevalrun.linux.uml.tmp  uevalrun.linux.uml  # Atomic replace.
./busybox ls -l uevalrun.linux.uml

# Full compile and extract time on narancs:
# 118.13user 14.18system 2:24.38elapsed 91%CPU (0avgtext+0avgdata 80528maxresident)k
# 4936inputs+1118032outputs (58major+2190404minor)pagefaults 0swaps

# TODO(pts): Cleanup: ./busybox rm -rf make_kernel.tmp

: All OK.
