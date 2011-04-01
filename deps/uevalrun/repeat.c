#include <errno.h>
#include <stdio.h>
#include <string.h>
#include <sys/types.h>
#include <sys/wait.h>
#include <unistd.h>

int main(int argc, char **argv) {
  pid_t child;
  int status, count;
  (void)argc;
  if (argv[1] == NULL || 1 != sscanf(argv[1], "%i", &count) ||
      argv[2] == NULL) {
    fprintf(stderr, "Usage: %s <count> <dir/prog> [<arg> ...]\n", argv[0]);
    return 1;
  }
  while (count != 0) {
    if (0 > (child = fork())) {
      fprintf(stderr, "error: fork failed: %s\n", strerror(errno));
      return 2;
    }
    if (child == 0) {
      execve(argv[2], argv + 2, NULL);
      fprintf(stderr, "error: child: %s: %s\n", argv[2], strerror(errno));
      return 125;
    }
    while (child != waitpid(child, &status, 0)) {}
    if (status != 0) {
      fprintf(stderr, "error: child failed with status=0x%x\n", status);
      return 3;
    }
    if (count > 0)
      --count;
  }
  return 0;
}
