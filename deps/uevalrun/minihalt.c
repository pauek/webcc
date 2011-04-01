/*
 * minihalt.c: init(1), halt(8) and mounter on uevalrun.rootfs.mini.minix.img
 * by pts@fazekas.hu at Wed Nov 24 02:14:18 CET 2010
 *
 * This program is free software; you can redistribute it and/or modify   
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation; either version 2 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 */

#include <errno.h>
#include <fcntl.h>
#include <sys/mount.h>
#include <sys/reboot.h>
#include <termios.h>
#include <unistd.h>

#define ERRMSG(msg) write(2, msg, sizeof msg - 1)

int main(int argc, char **argv, char **environ) {
  (void)argc; (void)argv;
  if (getpid() == 1) {
    char *args[] = { "/bin/sh", "/dev/ubdc", NULL };
    int fd;
    if (0 != mount("dummy", "/proc", "proc", MS_MGC_VAL, NULL)) {
      ERRMSG("minihalt: failed: mount dummy /proc -t proc\n");
      return 2;
    }
    if (0 != mount("/dev/ubdb", "/fs", "minix", MS_MGC_VAL, NULL)) {
      ERRMSG("minihalt: failed: mount /dev/ubdb /fs -t minix\n");
      return 2;
    }
    if (0 <= (fd = open(args[1], O_RDONLY))) {
      close(fd);
    } else {
      args[1] = NULL;  /* just /bin/sh */
    }
    return execve(args[0], args, environ);
  }
  /* EINVAL is returned if /fs is not mounted */
  if (0 != umount("/fs") && errno != EINVAL) {
    ERRMSG("minihalt: failed: umount /fs\n");
    return 2;
  }
  /* Make sure that con0 (/dev/tty0) is flushed to the UML host. */
  tcdrain(1);
  sync();
  return reboot(RB_HALT_SYSTEM);
}
