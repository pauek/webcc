/*
 * guestinit.c -- init(7) in the UML guest, for uevalrun
 * by pts@fazekas.hu at Mon Nov 22 02:36:01 CET 2010
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
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/fcntl.h>
#include <sys/ioctl.h>
#include <sys/klog.h>
#include <sys/mount.h>
#include <sys/mount.h>
#include <sys/reboot.h>
#include <sys/resource.h>
#include <sys/select.h>
#include <sys/stat.h>
#include <sys/wait.h>
#include <termios.h>
#include <unistd.h>

static void done(int exitcode) {
  char buf[sizeof(int) * 3 + 1];
  sprintf(buf, "%d\n", exitcode);
  if (exitcode != 0)
    fprintf(stderr, "guestinit: failure, exitcode=%d\n", exitcode);
  fflush(stdout);
  fflush(stderr);
  /* Make sure that con0 (/dev/tty0) is flushed to the UML host. */
  tcdrain(1);
  sync();
  /* RB_POWER_OFF: System halted., because no power management in UML */
  /* RB_HALT_SYSTEM: System halted. */
  /* RB_AUTOBOOT: Restarting system., UML exits with SIGABRT */
  write(open("/proc/exitcode", O_WRONLY), buf, strlen(buf));
  reboot(RB_HALT_SYSTEM);
}

static char rbuf[16 + 8192 + 1];
static char wbuf[8192];

static pid_t child;
static int status;

/** Returns 0 on success; -EINTR */
static int copy_output(int outfd, char which, char *done_flag) {
  int got = read(outfd, rbuf + 16, sizeof(rbuf) - 17);
  int rgot;
  char *p;
  if (0 > got) {
    if (errno == EINTR) {
      return 0;
    } else {
      fprintf(stderr, "guestinit: %s read failed: %s\n",
              which == STDOUT_FILENO ? "stdout" : "stderr",
              strerror(errno));
      return 1;
    }
  }
  if (0 == got) {
    *done_flag = 1;
  } else {
    rgot = got;
    p = rbuf + 16;
    p[got] = '\0';  /* Just for extra safety. */
    *--p = which == STDOUT_FILENO ? '>' : '!';
    do {
      *--p = rgot % 10 + '0';
      rgot /= 10;
    } while (rgot > 0);
    rgot = got + (rbuf + 16 - p);
    if (p[rgot - 1] != '\n')
      p[rgot++] = '\n';
    while (rgot > 0) {
      /* We don't care if this operation is blocking. */
      got = write(1, p, rgot);
      if (0 > got) {
        if (errno != EINTR) {
          fprintf(stderr, "guestinit: output write failed: %s\n", strerror(errno));
          return 1;
        }
      } else {
        p += got;
        rgot -= got;
      }
    }
  }
  return 0;
}

/** Convert subprocess exit wait() status to guestinit UML guest exitcode */
static int status_to_exitcode(int status) {
  if (WIFSIGNALED(status) && WTERMSIG(status) == SIGKILL) {
    /* TODO(pts): Better detect out-of-memory, e.g. by analyzing ELF
     * headers */
    return 2;
  } else if (WIFSIGNALED(status) && WTERMSIG(status) == SIGXCPU) {
    return 3;  /* TODO(pts): Get rid of these magic exitcode constants */
  }
  return 1;
}

/** Returns an UML exitcode (0 on success, a positive value on failure). */
static int work() {
  struct rlimit rl;
  fd_set rset;
  fd_set wset;
  int maxfd;
  char is_stdout_done, is_stderr_done, is_input_done;
  uint64_t fs, fsw;
  struct termios ti;
  int fd, got, wbufi, wbufl;
  int pinfds[2], pstdoutfds[2], pstderrfds[2];
  char *p, *q;
  char* env[] = { NULL };
  char* args[16];
  char is_ruby19 = 0;
  char is_gcx = 0;
  char *gcx_src_path = NULL;

  if (0 == tcgetattr(1, &ti)) {  /* Almost always true. */
    /* Don't convert \n to \n when printing. */
    ti.c_oflag &= ~ONLCR;
    if (0 != tcsetattr(1, TCSADRAIN, &ti)) {
      fprintf(stderr, "guestinit: tcsetattr() failed\n");
      return 1;
    }
  }
  fprintf(stderr, "guestinit: info: hello\n");
  if (0 != klogctl(8, NULL, 1)) {  /* Disable kernel logging to console except for KERN_EMERG */
    fprintf(stderr, "guestinit: could not set kernel console loglevel\n");
    return 1;
  }
  if (0 != mount("dummy", "/proc", "proc", MS_MGC_VAL, NULL)) {
    fprintf(stderr, "guestinit: mount /proc failed\n");
    return 1;
  }
  if (0 != setregid(1000, 1000)) {
    fprintf(stderr, "guestinit: setregid() failed\n");
    return 1;
  }

  if (0 > (fd = open("/proc/cmdline", O_RDONLY))) {  /* command to run */
    fprintf(stderr, "guestinit: open(/proc/cmdline) failed: %s\n",
            strerror(errno));
    return 1;
  }
  wbuf[0] = ' ';
  wbufl = 1;
  while (wbufl + 0U < sizeof wbuf - 1) {
    got = read(fd, wbuf + wbufl, sizeof wbuf - 1 - wbufl);
    if (got < 0) {
      fprintf(stderr, "guestinit: read(/dev/ubde) failed: %s\n",
                      strerror(errno));
      return 1;
    }
    if (got == 0)
      break;
    wbufl += got;
  }
  close(fd);
  wbuf[wbufl] = '\0';

  p = strstr(wbuf, " solution_format=");
  if (p == NULL) {
    fprintf(stderr, "guestinit: missing solution_format=");
    return 1;
  }
  p += sizeof(" solution_format=") - 1;
  q = p;
  while (*q != '\0' && *q != ' ' && *q != '\n' && *q != '\t')
    ++q;
  *q = '\0';

  if (0 == strcmp(p, "elf")) {
    args[0] = "/dev/ubdb";
    args[1] = NULL;
  } else if (0 == strcmp(p, "ruby1.8")) {
    args[0] = "/bin/ruby1.8";
    args[1] = "/dev/ubdb";
    args[2] = NULL;
  } else if (0 == strcmp(p, "ruby1.9")) {
    is_ruby19 = 1;
    args[0] = "/bin/ruby1.9";
    args[1] = "/dev/ubdb";
    args[2] = NULL;
  } else if (0 == strcmp(p, "ruby")) {
    args[0] = "/bin/ruby";
    args[1] = "/dev/ubdb";
    args[2] = NULL;
  } else if (0 == strcmp(p, "php")) {
    args[0] = "/bin/php";
    args[1] = "/dev/ubdb";
    args[2] = NULL;
  } else if (0 == strcmp(p, "perl")) {
    args[0] = "/bin/perl";
    args[1] = "/dev/ubdb";
    args[2] = NULL;
  } else if (0 == strcmp(p, "lua")) {
    args[0] = "/bin/lua";
    args[1] = "/dev/ubdb";
    args[2] = NULL;
  } else if (0 == strcmp(p, "javascript")) {
    args[0] = "/bin/js";
    args[1] = "/dev/ubdb";
    args[2] = NULL;
  } else if (0 == strcmp(p, "gcc")) {
    is_gcx = 1;
    gcx_src_path = "/tmp/prog.c";
    args[0] = "/bin/gcc";  /* This implies -static */
    /* This could be -o/proc/self/fd/1 , but we want to impose a size limit
     * on the created executable (in addition to the source file and the
     * assembly output).
     */
    /* TODO(pts): Make uevalrun.c report `No space left on device' smarter. */
    args[1] = "-o/tmp/prog",
    /* TODO(pts): Make these flags compatible. */
    /* Make sure that the args array is large enough. */
    args[2] = "-Wall";
    args[3] = "-W";
    args[4] = "-s";
    args[5] = "-O2";
    args[6] = gcx_src_path;
    args[7] = NULL;
  } else if (0 == strcmp(p, "gxx")) {
    is_gcx = 1;
    gcx_src_path = "/tmp/prog.cc";
    args[0] = "/bin/g++";  /* This implies -static */
    args[1] = "-o/tmp/prog",
    args[2] = "-Wall";
    args[3] = "-W";
    args[4] = "-s";
    args[5] = "-O2";
    args[6] = gcx_src_path;
    args[7] = NULL;
  } else if (0 == strcmp(p, "python")) {
    args[0] = "/bin/python";
    args[1] = "/dev/ubdb";
    args[2] = NULL;
  } else {
    fprintf(stderr, "guestinit: unknown solution_format: %s\n", p);
    return 1;
  }

  if (is_gcx) {
    if (0 > (fd = open("/dev/null", O_RDONLY))) {
      fprintf(stderr, "guestinit: open(/dev/null) failed: %s\n", strerror(errno));
      return 1;
    }
    fs = 0;
  } else {
    /* UML pads the file with '\0' to 512-byte block boundary, but we'll work
     * it around.
     */
    if (0 > (fd = open(is_gcx ? "/dev/null" : "/dev/ubdc", O_RDONLY))) {  /* input */
      fprintf(stderr, "guestinit: open(input) failed: %s\n", strerror(errno));
      return 1;
    }
    /* TIOCGPGRP works just in the UML patched by uevalrun. It's like
     * BLKGETSIZE64, but it doesn't round up (i.e. it returns the proper file
     * size).
     */
    if (0 != ioctl(fd, TIOCGPGRP, &fs)) {
      fprintf(stderr, "guestinit: size getting failed: %s\n", strerror(errno));
      return 1;
    }
  }
  if (0 != pipe(pinfds)) {
    fprintf(stderr, "guestinit: input pipe creation failed: %s\n", strerror(errno));
    return 1;
  }
  if (0 != pipe(pstdoutfds)) {
    fprintf(stderr, "guestinit: stdout pipe creation failed: %s\n", strerror(errno));
    return 1;
  }
  if (0 != pipe(pstderrfds)) {
    fprintf(stderr, "guestinit: stderr pipe creation failed: %s\n", strerror(errno));
    return 1;
  }

  if (pinfds[0] != 0) {
    if (0 != dup2(pinfds[0], 0)) {
      fprintf(stderr, "guestinit: dup2() for input pipe failed: %s\n", strerror(errno));
      return 1;
    }
    close(pinfds[0]);
  }

  if (is_gcx) {
    int src_fd, tmp_fd, wgot;
    uint64_t src_fs;
    char* mkargs[] = {
        "/bin/busybox", "mkfs.minix", "-n", "30", "-i", "8", "/dev/ubde",
        NULL
    };
    fflush(stdout);
    fflush(stderr);
    child = fork();
    if (child < 0) {
      fprintf(stderr, "guestinit: mktmp fork() failed: %s\n", strerror(errno));
      return 1;
    }
    if (child == 0) {  /* Child process. */
      status = execve(mkargs[0], mkargs, env);
      fprintf(stderr, "mktmp execve() failed (%d): %s\n",
              status, strerror(errno));
      exit(125);
    }
    while (child != waitpid(child, &status, 0)) {}
    if (status != 0) {
      fprintf(stderr, "guestinit: mktmp failed with status=0x%x\n", status);
      return 1;
    }
    /* /tmp is a symlink to /fs */
    if (0 != mount("/dev/ubde", "/fs", "minix", MS_MGC_VAL, NULL)) {
      fprintf(stderr, "guestinit: failed: mount /dev/ubde /fs -t minix: %s\n",
              strerror(errno));
      return 1;
    }
    if (0 != chmod("/fs", 01777)) {
      fprintf(stderr, "guestinit: chmod failed: /fs: %s\n", strerror(errno));
      return 1;
    }
    /* We can't just create a symlink (ln -s /dev/ubdb /tmp/prog.c),
     * because GCC won't compile block devices.
     */
    if (0 > (src_fd = open("/dev/ubdb", O_RDONLY))) {
      fprintf(stderr, "guestinit: open(source) failed: %s\n", strerror(errno));
      return 1;
    }

    if (0 != ioctl(src_fd, TIOCGPGRP, &src_fs)) {
      fprintf(stderr, "guestinit: source size getting failed: %s\n", strerror(errno));
      return 1;
    }
    if (0 > (tmp_fd = open(gcx_src_path, O_WRONLY | O_CREAT | O_EXCL, 0644))) {
      fprintf(stderr, "guestinit: open(%s) failed: %s\n",
              gcx_src_path, strerror(errno));
      return 1;
    }
    while (src_fs > 0) {
      got = read(src_fd, wbuf, src_fs > sizeof wbuf ? sizeof wbuf : src_fs);
      if (got > 0) {
        wgot = write(tmp_fd, wbuf, got);
        if (wgot == got) {
        } else if (wgot < 0) {
          fprintf(stderr, "guestinit: source copy write failed: %s\n",
                  strerror(errno));
          return 1;
        } else {
          fprintf(stderr, "guestinit: source copy write too short\n");
          return 1;
        }
      } else if (got == 0) {
        fprintf(stderr, "guestinit: source file too short\n");
        return 1;
      } else {
        fprintf(stderr, "guestinit: error reading source file: %s\n",
                strerror(errno));
        return 1;
      }
      src_fs -= got;
    }
    close(tmp_fd);
    close(src_fd);
  }

  /* Not giving up root (setreuid) because we have to halt the guest later. */
  fprintf(stderr, "guestinit: info: running solution binary\n");
  fflush(stdout);
  fflush(stderr);
  child = fork();
  if (child < 0) {
    fprintf(stderr, "guestinit: fork() failed: %s\n", strerror(errno));
    return 1;
  }
  if (child == 0) {  /* Child process. */
    close(fd);
    close(pinfds[1]);
    close(pstdoutfds[0]);
    close(pstderrfds[0]);
    if (is_gcx) {  /* Make the compiler stdout (if any) go to stderr */
      if (pstdoutfds[1] != pstderrfds[1]) {
        close(pstdoutfds[1]);
        pstdoutfds[1] = pstderrfds[1];
      }
    }
    fflush(stdout);
    if (pstdoutfds[1] != 1) {
      if (1 != dup2(pstdoutfds[1], 1)) {
        fprintf(stderr, "guestinit: child: dup2() for stdout pipe failed: %s\n", strerror(errno));
        exit(124);
      }
      if (pstdoutfds[1] != pstderrfds[1])
        close(pstdoutfds[1]);
    }
    fflush(stderr);
    if (pstderrfds[1] != 2) {
      if (2 != dup2(pstderrfds[1], 2)) {
        fprintf(stderr, "guestinit: child: dup2() for stderr pipe failed: %s\n", strerror(errno));
        exit(124);
      }
      close(pstderrfds[1]);
    }
    if (0 != setreuid(1000, 1000)) {
      fprintf(stderr, "guestinit: child: setreuid() failed\n");
      exit(124);
    }
    rl.rlim_cur = rl.rlim_max = 0;
    setrlimit(RLIMIT_CORE, &rl);
    rl.rlim_cur = rl.rlim_max = 0;
    setrlimit(RLIMIT_MEMLOCK, &rl);
    rl.rlim_cur = rl.rlim_max = RLIM_INFINITY;
    setrlimit(RLIMIT_STACK, &rl);

    if (is_gcx) {
      /* 4 should be enough for gcc */
      rl.rlim_max = rl.rlim_cur = 10;
      setrlimit(RLIMIT_NPROC, &rl);
    } else {    
      rl.rlim_cur = rl.rlim_max = 0;
      setrlimit(RLIMIT_FSIZE, &rl);
      rl.rlim_cur = rl.rlim_max = 0;
      setrlimit(RLIMIT_LOCKS, &rl);
      rl.rlim_cur = rl.rlim_max = 0;
      setrlimit(RLIMIT_MSGQUEUE, &rl);
      rl.rlim_cur = 10;
      rl.rlim_max = 10;
      setrlimit(RLIMIT_NOFILE, &rl);
      /* ruby1.9 needs 3 processes for its timer thread */
      rl.rlim_max = rl.rlim_cur = is_ruby19 ? 3 : 0;
      setrlimit(RLIMIT_NPROC, &rl);
    }
    status = execve(args[0], args, env);
    /* This will appear as the stderr of the child. */
    fprintf(stderr, "execve(%s) failed (%d): %s\n",
            args[0], status, strerror(errno));
    exit(125);  /* End of child process. */
  }
  close(0);
  close(pstdoutfds[1]);
  close(pstderrfds[1]);

  /* Copy from fd (input file) to pinfds[1] (writable end of pipe input) */
  if (fs == 0) {
    is_input_done = 1;
    close(fd);
    close(pinfds[1]);
  } else {
    is_input_done = 0;
  }
  is_stdout_done = 0;
  is_stderr_done = 0;
  if (is_gcx) {
    close(pstdoutfds[0]);
    is_stdout_done = 1;
  }
  maxfd = fd > pstdoutfds[0] ? fd : pstdoutfds[0];
  if (pstderrfds[0] > maxfd) maxfd = pstderrfds[0];
  ++maxfd;
  wbufi = wbufl = 0;
  fsw = fs;
  while (!(is_input_done && is_stdout_done && is_stderr_done)) {
    /* TODO(pts): Use poll to make it faster */
    FD_ZERO(&wset);
    if (!is_input_done)
      FD_SET(pinfds[1], &wset);
    FD_ZERO(&rset);
    if (!is_stdout_done)
      FD_SET(pstdoutfds[0], &rset);
    if (!is_stderr_done)
      FD_SET(pstderrfds[0], &rset);
    if (select(maxfd, &rset, &wset, NULL, NULL) == -1) {
      if (errno == EINTR) {
        continue;
      }
      fprintf(stderr, "guestinit: select() failed: %s\n", strerror(errno));
      return 1;
    }
    if (FD_ISSET(pinfds[1], &wset)) {
      if (wbufi == wbufl) {  /* No more data in write buffer. */
        if (fs == 0) {
          fprintf(stderr, "guestinit: unexpected EOF in input block, need more: %ld\n",
                  (long)fs);
          return 1;
        }
        wbufi = 0;
        got = read(fd, wbuf, fs > sizeof wbuf ? sizeof wbuf : fs);
        if (0 > got) {
          if (errno != EINTR) {
            fprintf(stderr, "guestinit: input read failed: %s\n", strerror(errno));
            return 1;
          }
        } else {
          if (0 == got) {
            fprintf(stderr, "guestinit: input EOF too early, need more: %ld\n", (long)fs);
            return 1;
          }
          wbufl = got;
          fs -= got;
          if (fs == 0)
            close(fd);
        }
      }
      got = write(pinfds[1], wbuf + wbufi, wbufl - wbufi);
      if (0 > got) {
        if (errno != EINTR) {
          fprintf(stderr, "guestinit: input pipe write failed: %s\n",
                  strerror(errno));
          return 1;
        }
      } else {
        wbufi += got;
        fsw -= got;
        if (fsw == 0) {
          is_input_done = 1;
          close(pinfds[1]);
        }
      }
    }
    /* Process pstderr before pstdout. */
    if (FD_ISSET(pstderrfds[0], &rset)) {
      if (0 != (got = copy_output(pstderrfds[0], STDERR_FILENO, &is_stderr_done)))
        return got;
      if (is_stderr_done && is_gcx) {  /* Just received EOF. */
        struct stat st;
        /* Wait for the compiler to finish. */
        while (child != waitpid(child, &status, 0)) {}
        if (status != 0) {
          fprintf(stderr, "\nguestinit: compiler failed with status=0x%x\n",
                  status);
          return status_to_exitcode(status);
        }
        /* TODO(pts): Display how long compilation took -- maybe in the host */
        fprintf(stderr, "\nguestinit: compilation successful\n");
        if (0 > (pstdoutfds[0] = open("/tmp/prog", O_RDONLY))) {
          fprintf(stderr, "guestinit: cannot open binary "
                  "created by the compiler: /tmp/prog: %s\n", strerror(errno));
          return 1;
        }
        if (0 != fstat(pstdoutfds[0], &st)) {
          fprintf(stderr, "guestinit: fstat: %s\n", strerror(errno));
          return 1;
        }
        fprintf(stderr, "guestinit: compiled binary size is %d bytes\n",
                (int)st.st_size);
        is_stdout_done = 0;
        if (maxfd <= pstdoutfds[0])
          maxfd = pstdoutfds[0] + 1;
      }
    }
    if (FD_ISSET(pstdoutfds[0], &rset)) {
      if (0 != (got = copy_output(pstdoutfds[0], STDOUT_FILENO, &is_stdout_done)))
        return got;
    }
  }
  close(fd);
  close(pinfds[1]);
  close(pstdoutfds[0]);
  close(pstderrfds[0]);
  if (!is_gcx) {
    /* We wait only this late (even for other processes closing the pipe) to
     * avoid the race condition between SIGCHLD and reading the output of the
     * child. We still won't receive the last few error messages.
     */
    while (child != waitpid(child, &status, 0)) {}
    if (status != 0) {
      fprintf(stderr, "\nguestinit: solution child failed with status=0x%x.\n", status);
      return status_to_exitcode(status);
    }
    fprintf(stderr, "\nguestinit: solution child successful\n");
  }
  return 0;
}

int main(int argc, char** argv) {
  (void)argc; (void)argv;
  if (getpid() != 1) {
    fprintf(stderr, "guestinit: run me as init (PID 1)!\n");
    return 2;
  }
  done(work());
  return 0;  /* Unreached. */
}
