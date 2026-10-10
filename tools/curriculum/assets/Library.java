import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;

/** Original finite borrowing lab. No Java object deserialization or external data. */
public final class Library {
    private record Book(String id, String title, int copies) {}
    private record Loan(long id, String book, String owner, boolean returned) {}
    private final Map<String, Book> books = new TreeMap<>();
    private final Map<Long, Loan> loans = new TreeMap<>();
    private long nextId = 1;

    private static void identifier(String value) {
        if (value == null || !value.matches("[A-Za-z][A-Za-z0-9_-]{0,39}")) {
            throw new IllegalArgumentException("identifier must be bounded ASCII token");
        }
    }

    public void addBook(String id, String title, int copies) {
        identifier(id);
        if (title == null || title.isBlank() || title.length() > 200
                || title.contains("\t") || title.contains("\r") || title.contains("\n")
                || copies < 1 || copies > 10000 || books.containsKey(id)) {
            throw new IllegalArgumentException("invalid or duplicate book");
        }
        books.put(id, new Book(id, title, copies));
    }

    public int available(String id) {
        Book book = books.get(id);
        if (book == null) throw new IllegalArgumentException("unknown book");
        long active = loans.values().stream().filter(l -> l.book().equals(id) && !l.returned()).count();
        return book.copies() - Math.toIntExact(active);
    }

    public long borrow(String book, String owner) {
        identifier(owner);
        if (available(book) == 0) throw new IllegalStateException("no stock");
        if (nextId == Long.MAX_VALUE) throw new IllegalStateException("loan ID exhausted");
        long id = nextId++;
        loans.put(id, new Loan(id, book, owner, false));
        return id;
    }

    public void giveBack(long id, String owner) {
        Loan loan = loans.get(id);
        if (loan == null) throw new IllegalArgumentException("unknown loan");
        if (!loan.owner().equals(owner)) throw new IllegalArgumentException("owner required");
        if (loan.returned()) throw new IllegalStateException("already returned");
        loans.put(id, new Loan(id, loan.book(), owner, true));
    }

    public void save(Path destination) throws IOException {
        StringBuilder text = new StringBuilder("V1\n");
        for (Book book : books.values()) {
            text.append("B\t").append(book.id()).append('\t').append(book.title())
                    .append('\t').append(book.copies()).append('\n');
        }
        for (Loan loan : loans.values()) {
            text.append("L\t").append(loan.id()).append('\t').append(loan.book())
                    .append('\t').append(loan.owner()).append('\t').append(loan.returned()).append('\n');
        }
        text.append("N\t").append(nextId).append('\n');
        Path temp = destination.resolveSibling(destination.getFileName() + ".tmp");
        Files.writeString(temp, text, StandardCharsets.UTF_8);
        Files.move(temp, destination, StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING);
    }

    public static Library load(Path source) throws IOException {
        if (Files.size(source) > 1048576) throw new IllegalArgumentException("snapshot too large");
        List<String> lines = Files.readAllLines(source, StandardCharsets.UTF_8);
        if (lines.isEmpty() || !lines.getFirst().equals("V1")) throw new IllegalArgumentException("unknown schema");
        Library result = new Library();
        boolean counter = false;
        for (String line : lines.subList(1, lines.size())) {
            String[] fields = line.split("\t", -1);
            if (fields[0].equals("B") && fields.length == 4) {
                result.addBook(fields[1], fields[2], Integer.parseInt(fields[3]));
            } else if (fields[0].equals("L") && fields.length == 5) {
                long id = Long.parseLong(fields[1]);
                identifier(fields[2]); identifier(fields[3]);
                if (id <= 0 || result.loans.containsKey(id)
                        || !(fields[4].equals("true") || fields[4].equals("false"))) {
                    throw new IllegalArgumentException("invalid loan");
                }
                result.loans.put(id, new Loan(id, fields[2], fields[3], Boolean.parseBoolean(fields[4])));
            } else if (fields[0].equals("N") && fields.length == 2 && !counter) {
                result.nextId = Long.parseLong(fields[1]); counter = true;
            } else {
                throw new IllegalArgumentException("malformed snapshot row");
            }
        }
        long greatest = result.loans.keySet().stream().mapToLong(Long::longValue).max().orElse(0);
        if (!counter || result.nextId <= greatest || result.nextId <= 0) {
            throw new IllegalArgumentException("invalid next loan ID");
        }
        for (Loan loan : result.loans.values()) {
            if (!result.books.containsKey(loan.book())) throw new IllegalArgumentException("dangling book");
        }
        for (String id : result.books.keySet()) {
            if (result.available(id) < 0) throw new IllegalArgumentException("overbooked snapshot");
        }
        return result;
    }
}
