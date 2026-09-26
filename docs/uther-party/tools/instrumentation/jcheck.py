"""jcheck.py MAPJ [prefix...] : light JASS checker (no pjass here).
Knows every native/BJ function and global from common.j + Blizzard.j + the map script.
For functions whose name starts with a prefix (default CL_ and Trig_Filter_Actions) it checks:
block balance, locals-before-statements, every called function exists with the right
argument count, every identifier resolves (local, parameter, global, function, keyword),
`function X` code refs take nothing, and value-returning functions end with return."""
import re, sys, os
GAME = r"path\to\scratch\w3data\game\Scripts"
KW = set('''function takes returns nothing endfunction native constant local set call if then else elseif endif
loop endloop exitwhen return and or not true false null globals endglobals array type extends code
integer real boolean string handle debug'''.split())


def strip(src):
    src = re.sub(r'"(?:[^"\\]|\\.)*"', '""', src)
    src = re.sub(r"'[^']{1,4}'", '0', src)
    src = re.sub(r"\$[0-9A-Fa-f]+", '0', src)
    return re.sub(r'//[^\n]*', '', src)


def load(paths):
    funcs, globs, types = {}, set(), set()
    for p in paths:
        s = strip(open(p, encoding='latin-1').read())
        for m in re.finditer(r'^\s*(?:constant\s+)?(?:native|function)\s+(\w+)\s+takes\s+(.*?)\s+returns\s+(\w+)', s, re.M):
            args = [] if m.group(2).strip() == 'nothing' else [a.strip() for a in m.group(2).split(',')]
            funcs[m.group(1)] = (len(args), m.group(3))
        for m in re.finditer(r'^\s*type\s+(\w+)', s, re.M):
            types.add(m.group(1))
        g = re.search(r'^globals(.*?)^endglobals', s, re.S | re.M)
        for blk in re.findall(r'^globals(.*?)^endglobals', s, re.S | re.M):
            for line in blk.split('\n'):
                t = line.split('=', 1)[0].split()
                if not t:
                    continue
                if t[0] == 'constant':
                    t = t[1:]
                if len(t) >= 2:
                    globs.add(t[2] if t[1] == 'array' else t[1])
    return funcs, globs, types


def split_args(s):
    depth, cur, out = 0, '', []
    for ch in s:
        if ch == '(':
            depth += 1
        elif ch == ')':
            depth -= 1
        if ch == ',' and depth == 0:
            out.append(cur); cur = ''
        else:
            cur += ch
    if cur.strip():
        out.append(cur)
    return out


def calls(expr):
    """yield (name, argstring) for every name( ... ) call in expr"""
    for m in re.finditer(r'\b(\w+)\s*\(', expr):
        i = m.end(); depth = 1; j = i
        while j < len(expr) and depth:
            if expr[j] == '(':
                depth += 1
            elif expr[j] == ')':
                depth -= 1
            j += 1
        yield m.group(1), expr[i:j - 1]


def main():
    mapj = sys.argv[1]
    prefixes = sys.argv[2:] or ['CL_', 'Trig_Filter_Actions']
    funcs, globs, types = load([os.path.join(GAME, 'common.j'), os.path.join(GAME, 'Blizzard.j'), mapj])
    src = strip(open(mapj, encoding='latin-1').read())
    errs = 0
    for m in re.finditer(r'^function (\w+) takes (.*?) returns (\w+)\s*\n(.*?)^endfunction', src, re.S | re.M):
        name, targs, ret, body = m.groups()
        if not any(name.startswith(p) for p in prefixes):
            continue
        names = set()
        if targs.strip() != 'nothing':
            for a in targs.split(','):
                names.add(a.split()[-1])
        stack, seen_stmt, has_ret = [], False, False
        lines = body.split('\n')
        for ln, line in enumerate(lines, 1):
            t = line.strip()
            if not t:
                continue
            w = re.match(r'[A-Za-z_]\w*', t).group(0) if re.match(r'[A-Za-z_]', t) else t.split()[0]
            where = f'{name}:{ln}: {t[:90]}'
            if w == 'local':
                if seen_stmt:
                    print('ERR local after statement', where); errs += 1
                p = t.split('=', 1)[0].split()
                names.add(p[3] if p[2] == 'array' else p[2])
                if p[1] not in types and p[1] not in KW:
                    print('ERR unknown type', where); errs += 1
                t = t.split('=', 1)[1] if '=' in t else ''
            else:
                seen_stmt = True
            if w == 'if':
                stack.append('if')
                if not t.endswith('then'):
                    print('ERR if without then', where); errs += 1
            elif w == 'elseif':
                if not stack or stack[-1] != 'if' or not t.endswith('then'):
                    print('ERR elseif', where); errs += 1
            elif w == 'else':
                if not stack or stack[-1] != 'if':
                    print('ERR else', where); errs += 1
            elif w == 'endif':
                if not stack or stack.pop() != 'if':
                    print('ERR endif', where); errs += 1
            elif w == 'loop':
                stack.append('loop')
            elif w == 'endloop':
                if not stack or stack.pop() != 'loop':
                    print('ERR endloop', where); errs += 1
            elif w == 'exitwhen':
                if 'loop' not in stack:
                    print('ERR exitwhen outside loop', where); errs += 1
            elif w == 'set':
                tgt = re.match(r'set\s+(\w+)', t).group(1)
                if tgt not in names and tgt not in globs:
                    print('ERR set unknown', tgt, where); errs += 1
            elif w == 'call':
                if not re.match(r'call\s+\w+\s*\(.*\)\s*$', t):
                    print('ERR call syntax', where); errs += 1
            elif w == 'return':
                if len(lines) - ln <= 2 and not stack:
                    has_ret = True
                if ret == 'nothing' and t != 'return':
                    print('ERR return value in nothing function', where); errs += 1
            elif w not in ('local',):
                print('ERR unknown statement', where); errs += 1
            if t.count('(') != t.count(')'):
                print('ERR paren balance', where); errs += 1
            for fn, args in calls(t):
                if fn in ('if', 'elseif', 'not', 'and', 'or', 'exitwhen', 'return'):
                    continue
                if fn in types:
                    continue
                if fn not in funcs:
                    print('ERR unknown function', fn, where); errs += 1
                    continue
                n = len(split_args(args))
                if n != funcs[fn][0]:
                    print(f'ERR {fn} takes {funcs[fn][0]} args, got {n}', where); errs += 1
            for cm in re.finditer(r'\bfunction\s+(\w+)', t):
                f = cm.group(1)
                if f not in funcs:
                    print('ERR unknown code ref', f, where); errs += 1
                elif funcs[f][0] != 0:
                    print('ERR code ref takes args', f, where); errs += 1
            body_t = re.sub(r'\bfunction\s+\w+', '', t)
            for idm in re.finditer(r'\b([A-Za-z_]\w*)\b', body_t):
                idn = idm.group(1)
                if idn in KW or idn in names or idn in globs or idn in funcs or idn in types:
                    continue
                if re.match(r'^\d', idn):
                    continue
                print('ERR unknown identifier', idn, where); errs += 1
        if stack:
            print('ERR unclosed', stack, name); errs += 1
        if ret != 'nothing' and not has_ret:
            print('ERR no final return', name); errs += 1
    print('jcheck:', errs, 'errors')
    return errs


if __name__ == '__main__':
    sys.exit(1 if main() else 0)
