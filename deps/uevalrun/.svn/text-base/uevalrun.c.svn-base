/*
 * uevalrun.c: Entry point executable for running solutions sandboxed.
 *
 * by pts@fazekas.hu at Sun Nov 21 20:00:22 CET 2010
 * --- Mon Nov 22 01:44:59 CET 2010
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
 *
 * TODO(pts): What error message do we report if the solution wants to
 *            write a very long wrong answer?
 * TODO(pts): make error messages more useful if the compilation fails
 * TODO(pts): Is there a 64MB limit (or just df?) for minix filesystems?
 * TODO(pts): move auxilary files like *-config to another dir
 * TODO(pts): Benchmark UML speed by running g++ hello.cc and g++ all.cc
 *            inside and outside UML (6x slower)
 * TODO(pts): Benchmark CPU-intensive calculations inside and outside UML.
 *            (1x slower).
 * * overhead:
 *   Intel(R) Core(TM)2 Duo CPU T6600 @ 2.20GHz, 4GB RAM.
 *   Just the UML kernel with a hello-world C binary: 50.0625 per second.
 *   Answer verification (uevalrun) for hello-world C binary: 43.3163 per second.
 * * we have to set: CONFIG_HIGH_RES_TIMERS=y
 *   to avoid this kernel syslog message: Switched to NOHz mode on CPU #0
 */

#include <errno.h>
#include <fcntl.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/ioctl.h>
#include <sys/resource.h>
#include <sys/select.h>
#include <sys/signal.h>
#include <sys/wait.h>
#include <unistd.h>

#define ELF_SHF_ALLOC (1 << 1)

enum {
  ST_MIDLINE = 1,
  ST_BOL = 2,
};

#define PTS_ISDIGIT(c) ((c) - '0' + 0U <= 9U)

static void out_of_memory() {
  printf("@ error: out of memory\n");
  exit(2);
}

static char *xstrcat(char const *s1, char const *s2) {
  size_t ss1 = strlen(s1);
  char *t = malloc(ss1 + strlen(s2) + 1);
  if (t == NULL)
    out_of_memory();
  memcpy(t, s1, ss1);
  strcpy(t + ss1, s2);
  return t;
}

static char *xstrcat3(char const *s1, char const *s2, char const *s3) {
  size_t ss1 = strlen(s1);
  size_t ss2 = strlen(s2);
  char *t = malloc(ss1 + ss2 + strlen(s3) + 1);
  if (t == NULL)
    out_of_memory();
  memcpy(t, s1, ss1);
  memcpy(t + ss1, s2, ss2);
  strcpy(t + ss1 + ss2, s3);
  return t;
}

static char *xslice(const char *s, size_t slen) {
  char *t = malloc(slen + 1);
  if (t == NULL)
    out_of_memory();
  memcpy(t, s, slen);
  t[slen] = '\0';
  return t;
}

/* Example command: "python", "php", "perl", "ruby", "ruby1.8", "ruby1.9",
 * "lua".
 *
 * The command "lua" matches "luajit" etc.
 */
static char shebang_has_command(const char *shebang, const char *command) {
  const char *p = shebang;
  int command_size = strlen(command);
  while (1) {
    while (*p != ' ' && *p !='\t' && *p != '/' && *p != '\0' && *p != '\n')
      ++p;
    if (*p == '\0' || *p == '\n')
      return 0;
    ++p;
    if (0 == strncmp(p, command, command_size))
      return 1;
  }
}

static void usage(const char* argv0) {
  printf("@ info: usage: %s -M <mem_mb> -T <timeout> "
         "-E <excess_answer_limit_kb> -s <solution_binary> "
         "[-C <compiler_disk_mb> -N <compiler_mem_mb> -U <compiler_timeout> "
         "-o <binary_output>] "
         "[-t <test_input> -e <expected_output>]\n", argv0);
}

/* --- Read buffering */

/** Characters read from the stdout of the UML process */
static char rbuf[8192];
static int rbuf_fd;
static char *rbuf_p, *rbuf_end;
fd_set rbuf_rset;

static void rbuf_init(int fd) {
  long flags;
  flags = fcntl(fd, F_GETFL);
  if (flags < 0) {
    printf("@ error: fcntl F_GETFL: %s\n", strerror(errno));
    exit(2);
  }
  if (0 != fcntl(fd, F_SETFL, flags | O_NONBLOCK)) {
    printf("@ error: fcntl F_SETFL: %s\n", strerror(errno));
    exit(2);
  }
  rbuf_fd = fd;
  rbuf_p = rbuf_end = rbuf;
  FD_ZERO(&rbuf_rset);
}

/** @return -1 on EOF */
static int rbuf_getc_heavy() {
  int got;
  if (rbuf_p == NULL)
    return -1;  /* EOF */
  if (rbuf_p != rbuf_end)
    return *(unsigned char*)rbuf_p++;
  while (1) {
    got = read(rbuf_fd, rbuf, sizeof rbuf);
    if (got > 0) {
      rbuf_p = rbuf;
      rbuf_end = rbuf + got;
      return *(unsigned char*)rbuf_p++;
    } else if (got == 0) {
      rbuf_p = rbuf_end = NULL;
      return -1;  /* EOF */
    } else if (errno == EAGAIN) {
      /* This fflush(stdout) is the only reason why we are doing input
       * buffering manually instead of using a FILE*.
       */
      fflush(stdout);
      FD_SET(rbuf_fd, &rbuf_rset);
      got = select(rbuf_fd + 1, &rbuf_rset, NULL, NULL, NULL);
      if (got < 0 && got != EINTR) {
        printf("\n error: error selecting for solution output pipe: %s\n",
               strerror(errno));
        exit(2);
      }
    } else if (errno != EINTR) {
      printf("\n@ error: error reading from solution output pipe: %s\n",
             strerror(errno));
      exit(2);
    }
  }
}

static inline int rbuf_getc() {
  if (rbuf_p != rbuf_end)
    return *(unsigned char*)rbuf_p++;
  return rbuf_getc_heavy();
}

/* --- */

#define IS_LCALPHA(c) ((c) - 'a' + 0U <= 'z' - 'a' + 0U)
#define IS_WSPACE(c) ( \
    (c) == ' ' || (c) == '\r' || (c) == '\n' || (c) == '\t' || (c) == '\0' || \
    (c) == '\f' || (c) == '\v')

/* This must return false for C code (which doesn't use C++ features). */
static char is_cplusplus_header(const char *hdr, int hdr_size) {
  /* TODO(pts): Do a more sophisticated matching, find `namespace', `using',
   * #include without a .h etc */
  while (hdr_size > 0 && IS_WSPACE(hdr[0])) {
    --hdr_size;
    ++hdr;
  }
  /* TODO(pts): Support `#  include' */
  return hdr_size >= 2 && hdr[0] == '/' && hdr[1] == '/';
}

static char is_c_header(const char *hdr, int hdr_size) {
  /* TODO(pts): Do a more sophisticated matching. */
  while (hdr_size > 0 && IS_WSPACE(hdr[0])) {
    --hdr_size;
    ++hdr;
  }
  /* TODO(pts): Support `#  include' */
  return (hdr_size >= 2 && hdr[0] == '/' && hdr[1] == '*') ||
         (hdr_size >= 2 && hdr[0] == '#' && IS_LCALPHA(hdr[1]));
}

typedef struct {
  /* TODO(pts): Disallow too small values for the limit options. */
  int mem_mb; /* -M */
  int timeout;  /* -T */
  int excess_answer_limit_kb; /* -E */
  /* Total maximum file size (+ minix filesystem overhead) of the source
   * file, the assembly output file (.s) and the binary (executable) file
   * produced by the compiler.
   */
  int compiler_disk_mb;  /* -C */
  int compiler_mem_mb;  /* -N */
  int compiler_timeout; /* -U */
  char *solution_binary;  /* -s */
  char *test_input; /* -t */
  char *binary_output; /* -o */
  char *expected_output; /* -e */

  char *prog_dir;
  char *argv0;
  char *gcxtmp_path;
  char is_binary_output_tmp;
} flags_s;

static int parse_cmdline(int argc, char** argv, flags_s *flags) {
  int opt, i;

  flags->mem_mb = -1;
  flags->compiler_mem_mb = -1;
  flags->timeout = -1;
  flags->compiler_timeout = -1;
  flags->excess_answer_limit_kb = -1;
  flags->compiler_disk_mb = -1;
  flags->solution_binary = NULL;
  flags->test_input = NULL;
  flags->binary_output = NULL;
  flags->expected_output = NULL;
  flags->prog_dir = NULL;
  flags->argv0 = argv[0];
  flags->is_binary_output_tmp = 0;
  flags->gcxtmp_path = NULL;

  if (argv[1] == NULL) {
    usage(argv[0]);
    return 1;
  }
  if (0 == strcmp(argv[1], "--help")) {
    usage(argv[0]);
    return 0;
  }

  while ((opt = getopt(argc, argv, "M:N:T:U:E:C:s:t:e:h:o:")) != -1) {
    if (opt == 'M') {
      if (1 != sscanf(optarg, "%i", &flags->mem_mb)) {
        printf("@ error: bad -M syntax\n");
        return 1;
      }
    } else if (opt == 'N') {
      if (1 != sscanf(optarg, "%i", &flags->compiler_mem_mb)) {
        printf("@ error: bad -N syntax\n");
        return 1;
      }
    } else if (opt == 'T') {
      if (1 != sscanf(optarg, "%i", &flags->timeout)) {
        printf("@ error: bad -T syntax\n");
        return 1;
      }
    } else if (opt == 'U') {
      if (1 != sscanf(optarg, "%i", &flags->compiler_timeout)) {
        printf("@ error: bad -U syntax\n");
        return 1;
      }
    } else if (opt == 'E') {
      if (1 != sscanf(optarg, "%i", &flags->excess_answer_limit_kb)) {
        printf("@ error: bad -E syntax\n");
        return 1;
      }
    } else if (opt == 'C') {
      if (1 != sscanf(optarg, "%i", &flags->compiler_disk_mb)) {
        printf("@ error: bad -C syntax\n");
        return 1;
      }
    } else if (opt == 's') {
      if (optarg[0] == '\0') {
        printf("@ error: bad -s syntax\n");
        return 1;
      }
      flags->solution_binary = optarg;
    } else if (opt == 't') {
      if (optarg[0] == '\0') {
        printf("@ error: bad -t syntax\n");
        return 1;
      }
      flags->test_input = optarg;
    } else if (opt == 'o') {
      if (optarg[0] == '\0') {
        printf("@ error: bad -o syntax\n");
        return 1;
      }
      flags->binary_output = optarg;
    } else if (opt == 'e') {
      if (optarg[0] == '\0') {
        printf("@ error: bad -t syntax\n");
        return 1;
      }
      flags->expected_output = optarg;
    } else {
      printf("@ error: unknown command-line flag\n");
      usage(argv[0]);
      return 1;
    }
  }
  if (optind < argc) {
    printf("@ error: too many command-line arguments\n");
    usage(argv[0]);
    return 1;
  }
  if (flags->mem_mb >= 0 ||
      flags->timeout >= 0 ||
      flags->excess_answer_limit_kb >= 0) {
    if (flags->mem_mb < 0) {
      printf("@ error: missing -M\n");
      usage(argv[0]);
      return 1;
    }
    if (flags->timeout < 0) {
      printf("@ error: missing -T\n");
      usage(argv[0]);
      return 1;
    }
    if (flags->excess_answer_limit_kb < 0) {
      printf("@ error: missing -E\n");
      usage(argv[0]);
      return 1;
    }
    if (flags->mem_mb == 0 || flags->mem_mb > 2000) {
      /* 4096MB is the absolute hard limit, since our UML is a 32-bit binary. */
      printf("@ error: expected 1 <= mem_mb <= 2000, got %d\n", flags->mem_mb);
      return 1;
    }
    if (flags->timeout == 0) {
      printf("@ error: expected 1 <= timeout, got %d\n", flags->timeout);
      return 1;
    }
  }
  if (flags->compiler_mem_mb >= 0 ||
      flags->compiler_timeout >= 0 ||
      flags->compiler_disk_mb >= 0) {
    if (flags->compiler_mem_mb < 0) {
      printf("@ error: missing -N\n");
      usage(argv[0]);
      return 1;
    }
    if (flags->compiler_timeout < 0) {
      printf("@ error: missing -U\n");
      usage(argv[0]);
      return 1;
    }
    if (flags->compiler_disk_mb < 0) {
      printf("@ error: missing -C\n");
      usage(argv[0]);
      return 1;
    }
    if (flags->compiler_mem_mb == 0 || flags->compiler_mem_mb > 2000) {
      /* 4096MB is the absolute hard limit, since our UML is a 32-bit binary. */
      printf("@ error: expected 1 <= compiler_mem_mb <= 2000, got %d\n", flags->compiler_mem_mb);
      return 2;
    }
    if (flags->compiler_timeout == 0) {
      printf("@ error: expected 1 <= compiler_timeout, got %d\n", flags->compiler_timeout);
      return 1;
    }
    if (flags->compiler_disk_mb == 0) {
      printf("@ error: expected 1 <= compiler_disk_mb, got %d\n",
             flags->compiler_disk_mb);
      return 1;
    }
  }
  if (flags->solution_binary == NULL) {
    printf("@ error: missing -s\n");
    usage(argv[0]);
    return 1;
  }

  i = strlen(argv[0]);
  while (i > 0 && argv[0][i - 1] != '/')
    --i;
  if (i > 0) { /* prog_dir = "" means "/" */
    flags->prog_dir = xslice(argv[0], i - 1);
  } else {
    flags->prog_dir = ".";
  }

  return 0;
}

static int work(flags_s *flags) {
  char hdr[128];  /* Should be at least 52, for reading ELF */
  int hdr_size;
  char mismatch_msg[128];
  char state;
  int pfd[2];
  int status;
  pid_t child;
  FILE *f, *fexp, *fout;
  int i, j, n, line, col;
  char is_gcx;
  char is_rootfs_missing;
  int answer_remaining;
  char *args[16];
  char *envs[] = {NULL};
  char mem_used;
  char memarg[16];
  char *uml_linux_path;
  char *uml_rootfs_path;
  char *guestinit_path;
  char *solution_format;

  if (NULL == (f = fopen(flags->solution_binary, "r"))) {
    printf("@ error: open solution binary: %s: %s\n", flags->solution_binary,
            strerror(errno));
    return 2;
  }
  memset(hdr, '\0', sizeof hdr);
  if (0 > (hdr_size = fread(hdr, 1, sizeof hdr - 1, f))) {
    printf("@ error: cannot read from solution binary: %s: %s\n",
           flags->solution_binary, strerror(errno));
    return 2;
  }
  hdr[hdr_size] = '\0';
  is_gcx = 0;
  if (hdr_size >= 4 && 0 == memcmp(hdr, "\177ELF", 4)) {
    unsigned char *u;
    unsigned long sh_ofs;  /* Section header table offset */
    unsigned long uflags;
    unsigned long long total_memsize;
    int sh_entsize;  /* Section header table entry size */
    int sh_num;  /* Section header table entry count */
    if (flags->mem_mb < 0) {
      printf("@ error: missing -M\n");
      usage(flags->argv0);
    }
    if (hdr_size < 52) {
      printf("@ error: solution binary too small, cannot be ELF: %s\n",
             flags->solution_binary);
      /* TODO(pts): fclose(f); fclose(fexp); everywhere */
      return 2;
    }
    if (hdr[4] != 1) {
      printf("@ error: solution binary not for 32-bit architecture: %s\n",
             flags->solution_binary);
      return 2;
    }
    if (hdr[5] != 1) {
      printf("@ error: solution binary not for LSB architecture: %s\n",
             flags->solution_binary);
      return 2;
    }
    if (hdr[16] != 2 || hdr[17] != 0) {
      printf("@ error: solution binary not an executable: %s\n",
             flags->solution_binary);
      return 2;
    }
    if (hdr[18] != 3 || hdr[19] != 0) {
      printf("@ error: solution binary not for x86 architecture: %s\n",
             flags->solution_binary);
      return 2;
    }
    if (hdr[20] != 1) {
      printf("@ error: solution binary not version 1: %s\n",
             flags->solution_binary);
      return 2;
    }
    if ((hdr[7] != 0 && hdr[7] != 3) || hdr[8] != 0) {
      printf("@ error: solution binary not for Linux: %s\n",
             flags->solution_binary);
      return 2;
    }
    u = (unsigned char*)hdr + 32;
    sh_ofs = u[0] | (u[1] << 8) | (u[2] << 16) | (u[3] << 24);
    u = (unsigned char*)hdr + 46;
    sh_entsize = u[0] | (u[1] << 8);
    sh_num = u[2] | (u[3] << 8);
    printf("@ info: sh_ofs=%lu sh_entsize=%d sh_num=%d\n",
           sh_ofs, sh_entsize, sh_num);
    if (sh_entsize + 0U > sizeof(hdr)) {
      printf("@ error: solution binary sh_entsize too large: %s: %d\n",
             flags->solution_binary, sh_entsize);
      return 2;
    }
    if (sh_num < 1) {
      printf("@ error: solution binary sh_num too small: %s: %d\n",
             flags->solution_binary, sh_num);
      return 2;
    }
    if (0 != fseek(f, sh_ofs, SEEK_SET)) {
      printf("@ error: cannot seek to sh_ofs: %s: %lu: %s\n",
             flags->solution_binary, sh_ofs, strerror(errno));
      return 2;
    }
    total_memsize = 0;
    for (i = 0; i < sh_num; ++i) {
      if (sh_entsize + 0U != fread(hdr, 1, sh_entsize, f)) {
        printf("@ error: cannot read section header in solution binary: "
               "%s: %d/%d: %s\n",
               flags->solution_binary, i, sh_num, strerror(errno));
        return 2;
      }
      u = (unsigned char*)hdr + 8;
      uflags = u[0] | (u[1] << 8) | (u[2] << 16) | (u[3] << 24);
      if ((uflags & ELF_SHF_ALLOC) != 0) {
        u = (unsigned char*)hdr + 20;
        total_memsize += u[0] | (u[1] << 8) | (u[2] << 16) | (u[3] << 24);
      }
    }
    if ((total_memsize >> 31) != 0) {
      printf("@ result: memory exceeded, needs way too static memory\n");
      return 3;
    }
    if (((total_memsize + ((1 << 20) - 1)) >> 20) >= flags->mem_mb + 0U) {
      printf("@ result: memory exceeded, needs too much static memory: %ldMB\n",
             (long)((total_memsize + ((1 << 20) - 1)) >> 20));
      return 3;
    }
    printf("@ info: total_memsize=%ldM\n",
           (long)((total_memsize + ((1 << 20) - 1)) >> 20));
    solution_format = "elf";
  } else if (hdr[0] == '#' && hdr[1] == '!') {
    if (shebang_has_command(hdr, "python")) {
      /* Having \0 characters at the end of the file is OK */
      solution_format = "python";
    } else if (shebang_has_command(hdr, "ruby1.8")) {  /* Before "ruby". */
      /* Having \0 characters at the end of the file is OK */
      solution_format = "ruby1.8";
    } else if (shebang_has_command(hdr, "ruby1.9")) {  /* Before "ruby". */
      /* Having \0 characters at the end of the file is OK */
      solution_format = "ruby1.9";
    } else if (shebang_has_command(hdr, "ruby")) {
      /* Having \0 characters at the end of the file is OK */
      solution_format = "ruby";
    } else if (shebang_has_command(hdr, "php")) {
      /* Having \0 characters at the end of the file is OK */
      solution_format = "php";
    } else if (shebang_has_command(hdr, "perl")) {
      /* Having \0 characters at the end of the file is OK */
      solution_format = "perl";
    } else if (shebang_has_command(hdr, "lua")) {  /* Also matches "luajit". */
      /* Having \0 characters at the end of the file is OK */
      solution_format = "lua";
    } else if (shebang_has_command(hdr, "js")) {
      /* Having \0 characters at the end of the file is OK */
      solution_format = "javascript";
    } else if (shebang_has_command(hdr, "smjs")) {
      /* Having \0 characters at the end of the file is OK */
      solution_format = "javascript";
    } else {
      printf("@ result: file format error: unknown shebang\n");
      return 2;
    }
  } else if (hdr_size > 5 && 0 == memcmp(hdr, "<?php", 5) &&
             (hdr[5] == ' ' || hdr[5] == '\t' || hdr[5] == '\n' ||
              hdr[5] == '\r')) {
    solution_format = "php";
  } else if (is_c_header(hdr, hdr_size)) {
    solution_format = "gcc";
    is_gcx = 1;
  } else if (is_cplusplus_header(hdr, hdr_size)) {
    solution_format = "gxx";
    is_gcx = 1;
  } else {
    printf("@ result: file format error: unknown file format\n");
    return 3;
  }
  fclose(f);

  if (flags->expected_output != NULL ||
      flags->test_input != NULL ||
      !is_gcx) {
    if (flags->test_input == NULL) {
      printf("@ error: missing -t\n");
      usage(flags->argv0);
      return 1;
    }
    if (flags->expected_output == NULL) {
      printf("@ error: missing -e\n");
      usage(flags->argv0);
      return 1;
    }
  }

  if (is_gcx) {
    if (flags->compiler_mem_mb == -1) {
      /* TODO(pts): Better error reporting if this is reached int the 2nd
       * phase, after compilation.
       */
      printf("@ error: missing -U\n");
      usage(flags->argv0);
      return 1;
    }
    if (flags->binary_output == NULL) {
      sprintf(mismatch_msg, "%d", (int)getpid());
      flags->is_binary_output_tmp = 1;
      /* TODO(pts): Clean up even on signal exit. */
      flags->binary_output = xstrcat3(
          flags->prog_dir, "/uevalrun.tmp.bin.", mismatch_msg);
    }
  } else {
    if (flags->binary_output != NULL) {
      printf("@ error: unexpected -o\n");
      usage(flags->argv0);
      return 1;
    }
  }

  if (flags->binary_output == NULL) {
    fout = NULL;
  } else if (NULL == (fout = fopen(flags->binary_output, "w"))) {
    printf("@ error: open binary output: %s: %s\n", flags->expected_output,
            strerror(errno));
    return 2;
  }

  if (is_gcx || flags->expected_output == NULL) {
    fexp = NULL;
  } else if (NULL == (fexp = fopen(flags->expected_output, "r"))) {
    printf("@ error: open expected output: %s: %s\n", flags->expected_output,
            strerror(errno));
    return 2;
  }

  if (is_gcx) {
    int fd;
    if (flags->compiler_disk_mb == -1) {
      printf("@ error: missing -C\n");
      usage(flags->argv0);
      return 1;
    }
    sprintf(mismatch_msg, "%d", (int)getpid());
    flags->gcxtmp_path = xstrcat3(
        flags->prog_dir, "/uevalrun.tmp.gccimg.", mismatch_msg);
    if (0 > (fd = open(flags->gcxtmp_path, O_WRONLY | O_CREAT, 0644))) {
      printf("@ error: cannot create gcxtmp: %s: %s\n",
             flags->gcxtmp_path, strerror(errno));
      return 2;
    }
    if (0 != ftruncate(fd, (off_t)flags->compiler_disk_mb << 20)) {
      printf("@ error: cannot set size of gcxtmp: %s: %s\n",
             flags->gcxtmp_path, strerror(errno));
      return 2;
    }
    /* No need to clear previous contents, the user won't be able
     * to read within the UML guest.
     */
    close(fd);
    /* TODO(pts): Security: remove this temporary image file when uevalrun
     * exits, so others won't be able to find it in the future.
     */
  }

  /* We don't care about free()ig the strings created by xstrcat etc.,
   * because they are small, and we don't allocate much.
   * TODO(pts): Revisit or validate this policy.
   */
  guestinit_path = xstrcat(flags->prog_dir, "/uevalrun.guestinit");
  if (NULL == (f = fopen(guestinit_path, "r"))) {
    printf("@ error: guestinit not found: %s: %s\n",
           guestinit_path, strerror(errno));
    return 2;
  }
  fclose(f);

  uml_linux_path = xstrcat(flags->prog_dir, "/uevalrun.linux.uml");
  if (NULL == (f = fopen(uml_linux_path, "r"))) {
    printf("@ error: uml_linux not found: %s: %s\n",
           uml_linux_path, strerror(errno));
    return 2;
  }
  fclose(f);

  is_rootfs_missing = 0;
  uml_rootfs_path = xstrcat(flags->prog_dir, "/uevalrun.rootfs.minix.img");
  if (NULL == (f = fopen(uml_rootfs_path, "r"))) {
    printf("@ error: uml rootfs not found: %s: %s\n",
           uml_rootfs_path, strerror(errno));
    printf("@ advice: run this first: (cd '%s' && ./make rootfs)\n",
           flags->prog_dir);
    is_rootfs_missing = 1;
  }

  if (is_gcx) {
    if (f != NULL)
      fclose(f);
    uml_rootfs_path = xstrcat(flags->prog_dir, "/uevalrun.rootfs.gcx.minix.img");
    if (NULL == (f = fopen(uml_rootfs_path, "r"))) {
      printf("@ error: uml_rootfs not found: %s: %s\n",
             uml_rootfs_path, strerror(errno));
      if (is_rootfs_missing) {
        printf("@ advice: run this first: (cd '%s' && "
               "./make rootfs rootfs_gcx)\n", flags->prog_dir);
      } else {
        printf("@ advice: run this first: (cd '%s' && ./make rootfs_gcx)\n",
               flags->prog_dir);
      }
      return 2;
    }
  } else if (is_rootfs_missing) {
    return 2;
  }
  fclose(f);

  /* 6MB is needed by the UML kernel and its buffers. It wouldn't work with
   * 5MB (probed).
   */
  mem_used = (is_gcx ? flags->compiler_mem_mb : flags->mem_mb) + 6;
  /* UML is unreliable with mem=9M, it crashes soon after printing
   * ``UML running in SKAS0 mode''
   * TODO(pts): Report this bug, find the root cause.
   */
  if (mem_used < 10)
    mem_used = 10;
  sprintf(memarg, "mem=%dM", mem_used);

  i = 0;
  args[i++] = uml_linux_path;
  args[i++] = "con=null";
  args[i++] = "ssl=null";
  args[i++] = "con0=fd:-1,fd:1";
  args[i++] = memarg;
  /* `r' means read-only, see 'r' in ubd_kern.c. We specify it so multiple
   * processes can concurrently open it.
   */
  args[i++] = xstrcat("ubdar=", uml_rootfs_path);
  args[i++] = xstrcat("ubdbr=", flags->solution_binary);
  /* TODO(pts): Verify that flags->test_input etc. don't contain comma, space or
   * something UML would interpret.
   */
  if (flags->test_input != NULL)
    args[i++] = xstrcat("ubdcr=", flags->test_input);
  args[i++] = xstrcat("ubddr=", guestinit_path);
  if (is_gcx)
    args[i++] = xstrcat("ubde=", flags->gcxtmp_path);
  args[i++] = xstrcat("solution_format=", solution_format);
  args[i++] = "init=/dev/ubdd";
  args[i] = NULL;

  if (0 != pipe(pfd)) {
    printf("@ error: pipe: %s\n", strerror(errno));
    return 2;
  }
  
  child = fork();
  if (child < 0) {
    printf("@ error: fork: %s\n", strerror(errno));
    return 2;
  }
  if (child == 0) {  /* Child */
    int fd;
    struct rlimit rl;
    int timeout_used = is_gcx ? flags->compiler_timeout : flags->timeout;
    close(0);
    close(pfd[0]);
    if (fexp != NULL)
      close(fileno(fexp));
    if (fout != NULL)
      close(fileno(fout));
    close(1);
    close(2);  /* TODO(pts): Report the errors nevertheless */
    if (0 <= (fd = open("/dev/tty", O_RDWR))) {
      ioctl(fd, TIOCNOTTY, 0);
      close(fd);
    }
    if ((pid_t)-1 == setsid())  /* Create a new process group (UML needs it). */
      exit(122);
    fd = open("/dev/null", O_RDONLY);
    if (fd != 0) {
      dup2(fd, 0);
      close(fd);
    }
    fd = open("/dev/null", O_WRONLY);
    if (fd != 2) {
      dup2(fd, 2);
      close(fd);
    }
    if (pfd[1] != 1) {
      if (1 != dup2(pfd[1], 1)) {
        printf("@ error: child: dup2: %s\n", strerror(errno));
        exit(121);
      }
      close(pfd[1]);
    }
    alarm(timeout_used + 3 + timeout_used / 10);
    /* UML needs more than 300 processes. This will be restricted to 0
     * just before the execve(...) to the temp binary.
     */
    rl.rlim_cur = 400;
    rl.rlim_max = 400; /* hard limit */
    setrlimit(RLIMIT_NPROC, &rl);
    rl.rlim_cur = 0;
    rl.rlim_max = 0;
    setrlimit(RLIMIT_CORE, &rl);
    rl.rlim_cur = timeout_used;
    rl.rlim_max = timeout_used + 2;
    /* This applies to all UML host subprocesses, but most of them don't
     * consume much CPU time, so this global limit should be fine.
     *
     * We don't want to impose this limit in the guest, because its timer
     * might not be accurate enough.
     */
    setrlimit(RLIMIT_CPU, &rl);
    execve(args[0], args, envs);
    printf("@ error: child: execve: %s\n", strerror(errno));
    exit(121);
  }
  close(pfd[1]);
  rbuf_init(pfd[0]);

  state = ST_MIDLINE;
  mismatch_msg[0] = '\0';
  line = 1;
  col = 1;
  answer_remaining = -1;
  /* TODO(pts): Limit the size of the answer */
  while (0 <= (i = rbuf_getc())) {
    if (state == ST_MIDLINE) {
      while (i != '\n') {
        putchar(i);
        if (0 > (i = rbuf_getc()))
          goto at_eof;
      }
      state = ST_BOL;
    }
    if (state == ST_BOL) {
      while (i == '\n') {
        putchar(i);
        if (0 > (i = rbuf_getc()))
          goto at_eof;
      }
      state = ST_MIDLINE;
      if (!PTS_ISDIGIT(i) || i == '0') {
       at_badhead:
        putchar(i);
        state = i == '\n' ? ST_BOL : ST_MIDLINE;
        continue;
      }
      putchar(i);
      n = i - '0';
      while (1) {
        if (0 > (i = rbuf_getc()))
          goto at_eof;
        if (!PTS_ISDIGIT(i))
          break;
        if (n > 9999)
          goto at_badhead;  /* Buffer size too long (would be >= 100000) */
        putchar(i);
        n = n * 10 + i - '0';
      }
      if (i != '>')
        goto at_badhead;
      if (is_gcx) {
        putchar('#');   /* Print '#' instead of '>' for compilation */
      } else {
        putchar(i);
      }
      if (fexp == NULL) {
        for (; n > 0; --n) {
          if (0 > (i = rbuf_getc())) {
            if (mismatch_msg[0] == '\0')
              sprintf(mismatch_msg, "@ error:  truncated binary\n");
            goto at_eof;
          }
          if (fout != NULL)
            putc(i, fout);
          if (i == '\n') {
            state = ST_BOL;
            ++line;
            col = 1;
          } else {
            state = ST_MIDLINE;
            ++col;
          }
        }
      } else {
        /* Now read n bytes as the output of the solution. */
        for (; n > 0; --n) {
          if (0 > (i = rbuf_getc()))
            goto at_eof;
          if (mismatch_msg[0] == '\0') {
            answer_remaining = flags->excess_answer_limit_kb << 10;
            if (0 > (j = getc(fexp))) {
              sprintf(mismatch_msg, "@ result: wrong answer, .exp is shorter at %d:%d\n", line, col);
            } else if (i != j) {
              sprintf(mismatch_msg, "@ result: wrong answer, first mismatch at %d:%d\n", line, col);
            }
          }
          if (answer_remaining >= 0) {
            if (answer_remaining-- == 0) {
              /* TODO(pts): Limit the length> already emitted. */
              printf("\n@ info: excess answer limit exceeded\n");
              goto at_eof_nl;
            }
          }
          putchar(i);
          if (fout != NULL)
            putc(i, fout);
          if (i == '\n') {
            state = ST_BOL;
            ++line;
            col = 1;
          } else {
            state = ST_MIDLINE;
            ++col;
          }
        }
      }
      state = ST_BOL;
    }
  }
 at_eof:
  if (state == ST_MIDLINE)
    putchar('\n');
 at_eof_nl:
  if (fexp != NULL) {
    if (mismatch_msg[0] == '\0' && !feof(fexp) && 0 <= (j = getc(fexp))) {
      sprintf(mismatch_msg,
              "@ result: wrong answer, .exp is longer at %d:%d\n", line, col);
    }
    if (ferror(fexp)) {
      printf("@ error: error reading expected output file\n");
      return 2;
    }
    fclose(fexp);
  }
  if (fout != NULL) {
    if (ferror(fout)) {
      printf("@ error: error writing binary output file\n");
      return 2;
    }
    fclose(fout);
  }
  close(pfd[0]);  /* rbuf_fd */
  if (child != waitpid(child, &status, WNOHANG)) {
    fflush(stdout);
    while (child != waitpid(child, &status, 0)) {}
  }

  if (status != 0) {
    if (mismatch_msg[0] == '\0') {
      printf("@ FYI, output matches\n");
    } else {
      memcpy(mismatch_msg, "@ FYI   ", 8);
      fputs(mismatch_msg, stdout);  /* emit previous mismatch */
    }
    if (WIFSIGNALED(status) && WTERMSIG(status) == SIGALRM) {
      printf("@ result: time limit exceeded, wall time\n");
    } else if (status == 0x300) {
      printf("@ result: time limit exceeded, user time\n");
    } else if (status == 0x200) {
      printf("@ result: static memory limit exceeded\n");
    } else if (status == 0x100) {
      /* Non-zero exit code or killed by signal. */
      if (is_gcx) {
        printf("@ result: compile error\n");
      } else {
        printf("@ result: runtime error\n");
      }
    } else {
      printf("@ result: framework error, status: 0x%x\n", status);
    }
    return 3;
  }
  if (mismatch_msg[0] != '\0') {
    fputs(mismatch_msg, stdout);
    return 3;
  }
  if (is_gcx) {
    if (flags->expected_output != NULL) {
      printf("@ info: compilation successful\n");
      fflush(stdout);
      return -2;
    } else {
      printf("@ result: compilation successful\n");
    }
  } else if (fexp == NULL) {
    printf("@ result: success\n");  /* Should never happen, is_gcx is true */
  } else {
    printf("@ result: pass\n");  /* Actual output matches expected output. */
  }
  return 0;
}

int main(int argc, char** argv) {
  flags_s flags;
  int ret;
  
  ret = parse_cmdline(argc, argv, &flags);
  if (ret != 0)
    return ret;

  /* Disable line buffering, to make writing the output faster. */
  setvbuf(stdout, NULL, _IOFBF, 8192);

  ret = work(&flags);
  if (flags.gcxtmp_path != NULL)
    unlink(flags.gcxtmp_path);
  /* TODO(pts): Get rid of magic constants for ret. */
  if (ret == -2) {  /* Run the binary after a successful compilation. */
    fflush(stdout);
    flags.solution_binary = flags.binary_output;
    flags.binary_output = NULL;
    flags.compiler_mem_mb = -1;
    flags.compiler_disk_mb = -1;
    flags.compiler_timeout = -1;
    ret = work(&flags);
    if (flags.is_binary_output_tmp)
      unlink(flags.solution_binary);
  } else {
    if (flags.is_binary_output_tmp)
      unlink(flags.binary_output);
  }
  return ret;
}
