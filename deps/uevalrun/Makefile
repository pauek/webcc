#
# Makefile for uevalrun
# by pts@fazekas.hu at Mon Nov 22 02:19:12 CET 2010
#
# TODO(pts): Add `make mrproper' to clean up all temporary files and dirs.

SHELL = ./busybox sh
export SHELL
PATH = /dev/null  # Busybox doesn't need it.
export PATH

# This must be a 32-bit compiler.
# TODO(pts): How to enforce 32-bit output for GCC?
CCBIN = cross-compiler/bin/i686-gcc
CFLAGS = -s -O2 -static -W -Wall
CC = $(CCBIN)

# TODO(pts): Configure that some of these features are not needed.
ALL = uevalrun uevalrun.guestinit minihalt uevalrun.rootfs.minix.img uevalrun.rootfs.gcx.minix.img
AUX = repeat

.PHONY: all clean run_sys run_mini_sys run_gcx_sys rootfs rootfs_gcx

all: $(ALL)

clean:
	./busybox rm -f $(ALL) $(AUX)

# Cancel some implicit rules of GNU make.
%: %.c
%.o: %.c
%.o: %.s

$(CCBIN):
	./busybox sh download.sh gcxbase.stbx86.tbz2 gcc.stbx86.tbz2
	./busybox mkdir -p cross-compiler
	cd cross-compiler && ../busybox tar xjf ../gcxbase.stbx86.tbz2
	cd cross-compiler && ../busybox tar xjf ../gcc.stbx86.tbz2
	test -x $(CCBIN)

uevalrun: uevalrun.c $(CCBIN)
	$(CC) $(CFLAGS) -o $@ $<

repeat: repeat.c $(CCBIN)
	$(CC) $(CFLAGS) -o $@ $<

minihalt: minihalt.c $(CCBIN)
	$(CC) $(CFLAGS) -o $@ $<

uevalrun.guestinit: guestinit.c $(CCBIN)
	$(CC) $(CFLAGS) -o $@ $<

# Easier to manage the binary here (e.g. with cp precompiled/* .)
xcat: examples/xcat.c $(CCBIN)
	$(CC) $(CFLAGS) -o $@ $<

# TODO(pts): Maybe add dependency on ruby1.8 etc. later
rootfs uevalrun.rootfs.minix.img: ./busybox make_rootfs.sh
	./busybox sh ./make_rootfs.sh

rootfs_gcx uevalrun.rootfs.gcx.minix.img: ./busybox make_rootfs_gcx.sh
	./busybox sh ./make_rootfs_gcx.sh

run_sys: uevalrun.rootfs.minix.img
	./uevalrun.linux.uml con=null ssl=null con0=fd:0,fd:1 mem=30M ubda=uevalrun.rootfs.minix.img rw

run_mini_sys: uevalrun.rootfs.mini.minix.img
	./uevalrun.linux.uml con=null ssl=null con0=fd:0,fd:1 mem=30M ubda=uevalrun.rootfs.mini.minix.img init=/bin/sh rw

run_gcx_sys: uevalrun.rootfs.gcx.minix.img
	./busybox dd if=/dev/zero of=uevalrun.rootfs.gcxtmp.minix.img bs=2000K count=1
	./busybox mkfs.minix -n 30 -i 20 uevalrun.rootfs.gcxtmp.minix.img
	./uevalrun.linux.uml con=null ssl=null con0=fd:0,fd:1 mem=60M ubda=uevalrun.rootfs.gcx.minix.img ubdb=uevalrun.rootfs.gcxtmp.minix.img init=/sbin/minihalt rw ubde=hello.c

precompile: uevalrun uevalrun.guestinit minihalt xcat
	./busybox sh ./make_rootfs_mini.sh
	./busybox cp $^ precompiled/
