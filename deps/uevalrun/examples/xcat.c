#include <stdio.h>
#include <unistd.h>
#include <stdlib.h>

char t[24 << 20];  /* 24MB -- give 6MB to the kernel and others -- 5MB is not enough */
/* char t[1 << 28] */ /* 256MB */

#if 0
static int rec() {
  return 1 + rec();
}
#endif

int main() {
  int i;
  printf("Hi!\n");
  fflush(stdout);
  fprintf(stderr, "Output to stderr ignored.\n");
  fflush(stderr);
#if 0
  rec();  /* Causes SIGSEGV --> runtime error */
#endif
#if 0
  for (;;) {}
#endif
#if 0
  sleep(2);
#endif
  while (0 <= (i = getchar())) {
    putchar(':');
    putchar(i);
  }
  return 0;
}
