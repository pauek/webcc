/* by pts@fazekas.hu at Thu Nov 25 14:15:38 CET 2010 */

#define _(x) x

extern void rb_provide(const char *feature);

void Init_bigdecimal _((void));
void Init_curses _((void));
void Init_digest _((void));
void Init_etc _((void));
void Init_fcntl _((void));
void Init_nkf _((void));
void Init_pty _((void));
void Init_readline _((void));
void Init_sdbm _((void));
void Init_socket _((void));
void Init_stringio _((void));
void Init_strscan _((void));
void Init_syck _((void));
void Init_syslog _((void));
void Init_zlib _((void));

void
Init_ext()
{
    Init_bigdecimal();
    rb_provide("bigdecimal.so");
    Init_curses();
    rb_provide("curses.so");
    Init_digest();
    rb_provide("digest.so");
    Init_etc();
    rb_provide("etc.so");
    Init_fcntl();
    rb_provide("fcntl.so");
    Init_nkf();
    rb_provide("nkf.so");
    Init_pty();
    rb_provide("pty.so");
    Init_readline();
    rb_provide("readline.so");
    Init_sdbm();
    rb_provide("sdbm.so");
    Init_socket();
    rb_provide("socket.so");
    Init_stringio();
    rb_provide("stringio.so");
    Init_strscan();
    rb_provide("strscan.so");
    Init_syck();
    rb_provide("syck.so");
    Init_syslog();
    rb_provide("syslog.so");
    Init_zlib();
    rb_provide("zlib.so");
}
