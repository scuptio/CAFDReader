//! 平台宿主仅保管文件与个人记录，不解释书页和阅读业务。
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sha2::{Digest, Sha256};
use std::{
    fs::{self, File},
    io::{Read, Seek, SeekFrom, Write},
    path::{Path, PathBuf},
};

pub type Result<T> = std::result::Result<T, String>;
pub const MAX_BOOK: u64 = 2 * 1024 * 1024 * 1024;

#[derive(Clone, Serialize, Deserialize)]
pub struct Book {
    pub id: String,
    pub file: String,
    pub bytes: u64,
    pub title: String,
    pub author: String,
    pub version: String,
    pub quality: String,
    pub root_hash: String,
    pub cover: bool,
}

pub struct Store {
    pub root: PathBuf,
}
pub fn valid_hash(value: &str) -> bool {
    value.len() == 64
        && value
            .bytes()
            .all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b))
}
pub fn checked_hash(value: &str) -> Result<&str> {
    if valid_hash(value) {
        Ok(value)
    } else {
        Err("书籍标识无效".into())
    }
}
fn checked_key(value: &str) -> Result<&str> {
    if value.is_empty()
        || value.len() > 64
        || !value
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b"_:-".contains(&b))
    {
        return Err("个人记录键无效".into());
    }
    Ok(value)
}
pub fn atomic_write(path: &Path, bytes: &[u8]) -> Result<()> {
    let parent = path.parent().ok_or("保存路径无效")?;
    fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    let temp = parent.join(format!(".{}.tmp", uuid::Uuid::new_v4()));
    let result = (|| {
        let mut file = File::create(&temp)?;
        file.write_all(bytes)?;
        file.sync_all()?;
        fs::rename(&temp, path)
    })();
    if result.is_err() {
        let _ = fs::remove_file(&temp);
    }
    result.map_err(|e: std::io::Error| e.to_string())
}
impl Store {
    pub fn new(root: PathBuf) -> Result<Self> {
        for part in ["books", "metadata", "covers", "personal"] {
            fs::create_dir_all(root.join(part)).map_err(|e| e.to_string())?;
        }
        Ok(Self { root })
    }
    pub fn book_path(&self, id: &str) -> Result<PathBuf> {
        let id = checked_hash(id)?;
        let current = self.root.join("books").join(format!("{id}.cafd"));
        let legacy = self.root.join("books").join(format!("{id}.caf"));
        // 旧私有书架原位兼容，个人记录仍按原根哈希读取。
        Ok(if !current.exists() && legacy.is_file() { legacy } else { current })
    }
    pub fn cover_path(&self, id: &str) -> Result<PathBuf> {
        Ok(self
            .root
            .join("covers")
            .join(format!("{}.jpg", checked_hash(id)?)))
    }
    pub fn metadata_path(&self, id: &str) -> Result<PathBuf> {
        Ok(self
            .root
            .join("metadata")
            .join(format!("{}.json", checked_hash(id)?)))
    }
    pub fn import(&self, mut input: impl Read, name: &str) -> Result<Book> {
        let mut header = [0; 92];
        input
            .read_exact(&mut header)
            .map_err(|_| "文件不是完整的 CAF".to_string())?;
        if &header[..4] != b"CAF\0" {
            return Err("文件不是 CAF".into());
        }
        let temp = self
            .root
            .join("books")
            .join(format!(".{}.tmp", uuid::Uuid::new_v4()));
        let result = (|| -> Result<Book> {
            let mut file = File::create(&temp).map_err(|e| e.to_string())?;
            let mut hash = Sha256::new();
            hash.update(header);
            file.write_all(&header).map_err(|e| e.to_string())?;
            let mut bytes = 92u64;
            let mut buffer = vec![0; 1024 * 1024];
            loop {
                let count = input.read(&mut buffer).map_err(|e| e.to_string())?;
                if count == 0 {
                    break;
                }
                bytes += count as u64;
                if bytes > MAX_BOOK {
                    return Err("本版单册最大支持 2 GiB".into());
                }
                hash.update(&buffer[..count]);
                file.write_all(&buffer[..count])
                    .map_err(|e| e.to_string())?;
            }
            file.sync_all().map_err(|e| e.to_string())?;
            drop(file);
            let id = hash
                .finalize()
                .iter()
                .map(|b| format!("{b:02x}"))
                .collect::<String>();
            let destination = self.book_path(&id)?;
            if destination.exists() {
                fs::remove_file(&temp).map_err(|e| e.to_string())?;
            } else {
                fs::rename(&temp, destination).map_err(|e| e.to_string())?;
            }
            Ok(Book {
                id,
                file: Path::new(name)
                    .file_name()
                    .and_then(|s| s.to_str())
                    .unwrap_or("文档.cafd")
                    .to_string(),
                bytes,
                title: String::new(),
                author: String::new(),
                version: String::new(),
                quality: String::new(),
                root_hash: String::new(),
                cover: false,
            })
        })();
        if result.is_err() {
            let _ = fs::remove_file(temp);
        }
        result
    }
    pub fn commit(&self, book: Book, cover: Option<Vec<u8>>) -> Result<Book> {
        checked_hash(&book.root_hash)?;
        if !self.book_path(&book.id)?.is_file() {
            return Err("书籍尚未导入".into());
        }
        if book.bytes
            != fs::metadata(self.book_path(&book.id)?)
                .map_err(|e| e.to_string())?
                .len()
            || book.title.is_empty()
            || book.title.len() > 4096
            || book.author.len() > 4096
            || book.version.len() > 128
            || book.quality.len() > 128
            || book.file.len() > 1024
        {
            return Err("书籍元信息无效".into());
        }
        let mut book = book;
        if let Some(bytes) = cover {
            if bytes.len() > 1024 * 1024 || !bytes.starts_with(&[255, 216, 255]) {
                return Err("封面格式或大小无效".into());
            }
            atomic_write(&self.cover_path(&book.id)?, &bytes)?;
            book.cover = true;
        } else {
            book.cover = self.cover_path(&book.id)?.is_file();
        }
        atomic_write(
            &self.metadata_path(&book.id)?,
            &serde_json::to_vec_pretty(&book).map_err(|e| e.to_string())?,
        )?;
        Ok(book)
    }
    pub fn list(&self) -> Result<Vec<Book>> {
        let mut books = Vec::new();
        for entry in fs::read_dir(self.root.join("metadata")).map_err(|e| e.to_string())? {
            let entry = entry.map_err(|e| e.to_string())?;
            if entry.path().extension().and_then(|s| s.to_str()) != Some("json") {
                continue;
            }
            let book: Book =
                serde_json::from_slice(&fs::read(entry.path()).map_err(|e| e.to_string())?)
                    .map_err(|e| e.to_string())?;
            if self.book_path(&book.id)?.is_file() {
                books.push(book);
            }
        }
        books.sort_by(|a, b| a.title.cmp(&b.title).then(a.id.cmp(&b.id)));
        Ok(books)
    }
    fn personal_path(&self, root: &str, key: &str) -> Result<PathBuf> {
        Ok(self
            .root
            .join("personal")
            .join(checked_hash(root)?)
            .join(format!("{}.json", checked_key(key)?)))
    }
    pub fn personal_get(&self, root: &str, key: &str) -> Result<Option<Value>> {
        let path = self.personal_path(root, key)?;
        match fs::read(path) {
            Ok(bytes) => serde_json::from_slice(&bytes)
                .map(Some)
                .map_err(|e| e.to_string()),
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
            Err(e) => Err(e.to_string()),
        }
    }
    pub fn personal_set(&self, root: &str, key: &str, value: Value) -> Result<()> {
        let path = self.personal_path(root, key)?;
        let data = serde_json::to_vec(&value).map_err(|e| e.to_string())?;
        // UTF-8 上限比前端 UTF-16 字符限额宽，仍对每书键数独立限额。
        if data.len() > 16384 {
            return Err("个人记录过大".into());
        }
        if !path.exists()
            && path.parent().unwrap().exists()
            && fs::read_dir(path.parent().unwrap())
                .map_err(|e| e.to_string())?
                .filter_map(|e| e.ok())
                .filter(|e| e.path().extension().and_then(|s| s.to_str()) == Some("json"))
                .count()
                >= 16
        {
            return Err("本书存储键数量已达上限".into());
        }
        atomic_write(&path, &data)
    }
}

pub fn byte_range(header: Option<&str>, len: u64) -> Result<Option<(u64, u64)>> {
    let Some(header) = header else {
        return Ok(None);
    };
    let body = header.strip_prefix("bytes=").ok_or("无效 Range")?;
    let (start, end) = body.split_once('-').ok_or("无效 Range")?;
    if body.contains(',') || len == 0 {
        return Err("无效 Range".into());
    }
    let (start, end) = if start.is_empty() {
        let count: u64 = end.parse().map_err(|_| "无效 Range")?;
        if count == 0 {
            return Err("无效 Range".into());
        }
        (len.saturating_sub(count), len - 1)
    } else {
        let start: u64 = start.parse().map_err(|_| "无效 Range")?;
        let end = if end.is_empty() {
            len - 1
        } else {
            end.parse::<u64>().map_err(|_| "无效 Range")?.min(len - 1)
        };
        (start, end)
    };
    if start >= len || end < start {
        return Err("Range 越界".into());
    }
    Ok(Some((start, end)))
}
pub fn read_bytes(path: &Path, range: Option<(u64, u64)>) -> Result<Vec<u8>> {
    let mut file = File::open(path).map_err(|e| e.to_string())?;
    match range {
        None => {
            let mut bytes = Vec::new();
            file.read_to_end(&mut bytes).map_err(|e| e.to_string())?;
            Ok(bytes)
        }
        Some((a, b)) => {
            file.seek(SeekFrom::Start(a)).map_err(|e| e.to_string())?;
            let mut bytes = vec![0; (b - a + 1) as usize];
            file.read_exact(&mut bytes).map_err(|e| e.to_string())?;
            Ok(bytes)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    fn store() -> Store {
        Store::new(std::env::temp_dir().join(format!("caf-store-test-{}", uuid::Uuid::new_v4())))
            .unwrap()
    }
    #[test]
    fn ranges_reject_escape_and_support_open_suffix() {
        assert_eq!(byte_range(Some("bytes=2-5"), 10).unwrap(), Some((2, 5)));
        assert_eq!(byte_range(Some("bytes=8-"), 10).unwrap(), Some((8, 9)));
        assert_eq!(byte_range(Some("bytes=-3"), 10).unwrap(), Some((7, 9)));
        for h in [
            "bytes=10-11",
            "bytes=6-2",
            "bytes=0-1,3-4",
            "bytes=-0",
            "other=0-1",
        ] {
            assert!(byte_range(Some(h), 10).is_err());
        }
        assert!(checked_hash("../private").is_err());
        assert!(checked_key("../private").is_err());
    }
    #[test]
    fn import_is_deduplicated_and_unverified_books_stay_off_shelf() {
        let s = store();
        let mut data = vec![0; 200];
        data[..4].copy_from_slice(b"CAF\0");
        let mut a = s.import(&data[..], "书.cafd").unwrap();
        let b = s.import(&data[..], "副本.cafd").unwrap();
        assert_eq!(a.id, b.id);
        assert!(s.list().unwrap().is_empty());
        assert_eq!(
            read_bytes(&s.book_path(&a.id).unwrap(), Some((2, 5))).unwrap(),
            data[2..6]
        );
        a.root_hash = "a".repeat(64);
        a.title = "测试".into();
        s.commit(a, None).unwrap();
        assert_eq!(s.list().unwrap().len(), 1);
        assert!(s.import(&b"not a CAF"[..], "坏.cafd").is_err());
        fs::remove_dir_all(s.root).unwrap();
    }
    #[test]
    fn personal_data_is_atomic_isolated_and_survives_reopen() {
        let s = store();
        let a = "a".repeat(64);
        let b = "b".repeat(64);
        s.personal_set(&a, "mark", serde_json::json!({"text":"心得"}))
            .unwrap();
        assert_eq!(
            Store::new(s.root.clone())
                .unwrap()
                .personal_get(&a, "mark")
                .unwrap()
                .unwrap()["text"],
            "心得"
        );
        assert!(s.personal_get(&b, "mark").unwrap().is_none());
        assert!(s.personal_set(&a, "../outside", Value::Null).is_err());
        for n in 0..15 {
            s.personal_set(&a, &format!("key{n}"), Value::Null).unwrap();
        }
        assert!(s.personal_set(&a, "overflow", Value::Null).is_err());
        s.personal_set(&a, "mark", Value::Null).unwrap();
        fs::remove_dir_all(s.root).unwrap();
    }
    #[test]
    fn legacy_caf_books_and_personal_records_remain_readable() {
        let s = store();
        let mut data = vec![0; 200];
        data[..4].copy_from_slice(b"CAF\0");
        let mut book = s.import(&data[..], "旧文档.caf").unwrap();
        let current = s.book_path(&book.id).unwrap();
        assert_eq!(current.extension().unwrap(), "cafd");
        let legacy = current.with_extension("caf");
        fs::rename(&current, &legacy).unwrap();
        book.title = "旧文档".into();
        book.root_hash = "a".repeat(64);
        s.personal_set(&book.root_hash, "progress", serde_json::json!({"page":7})).unwrap();
        s.commit(book.clone(), None).unwrap();
        let reopened = Store::new(s.root.clone()).unwrap();
        assert_eq!(reopened.book_path(&book.id).unwrap(), legacy);
        assert_eq!(reopened.list().unwrap().len(), 1);
        assert_eq!(reopened.import(&data[..], "新文档.cafd").unwrap().id, book.id);
        assert_eq!(reopened.personal_get(&book.root_hash, "progress").unwrap().unwrap()["page"], 7);
        assert!(!current.exists());
        fs::remove_dir_all(s.root).unwrap();
    }
}
