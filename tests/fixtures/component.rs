//! 独立协议夹具。只经 CAF payload-fs 读取 /meta.json，无第三方 crate 或内容项目依赖。
#[link(wasm_import_module = "caf")]
extern "C" {
    fn open(ptr:u32,len:u32)->i32;
    fn read(fd:i32,ptr:u32,len:u32)->i32;
    fn close(fd:i32)->i32;
}
#[no_mangle]
pub extern "C" fn alloc(len:u32)->u32 {
    if len==0{return 0;}
    let mut bytes=vec![0u8;len as usize].into_boxed_slice();
    let ptr=bytes.as_mut_ptr() as u32;std::mem::forget(bytes);ptr
}
#[no_mangle]
pub unsafe extern "C" fn dealloc(ptr:u32,len:u32){
    if ptr!=0&&len!=0{drop(Box::from_raw(std::ptr::slice_from_raw_parts_mut(ptr as *mut u8,len as usize)));}
}
fn pack(value:Vec<u8>)->u64 {
    let bytes=value.into_boxed_slice();let ptr=bytes.as_ptr() as u64;let len=bytes.len() as u64;
    std::mem::forget(bytes);ptr|(len<<32)
}
#[no_mangle]
pub extern "C" fn info()->u64 {
    let path=b"/meta.json";let fd=unsafe{open(path.as_ptr() as u32,path.len() as u32)};
    if fd<0{return pack(br#"{"error":"metadata unavailable"}"#.to_vec());}
    let mut value=Vec::new();let mut buffer=[0u8;4096];
    loop{let n=unsafe{read(fd,buffer.as_mut_ptr() as u32,buffer.len() as u32)};if n<=0{break;}value.extend_from_slice(&buffer[..n as usize]);}
    unsafe{close(fd)};pack(value)
}
#[no_mangle] pub extern "C" fn toc()->u64{pack(b"[]".to_vec())}
fn unavailable()->u64{pack(br#"{"error":"fixture only"}"#.to_vec())}
#[no_mangle] pub extern "C" fn get(_:u32,_:u32)->u64{unavailable()}
#[no_mangle] pub extern "C" fn window(_:u32,_:u32,_:u32)->u64{unavailable()}
#[no_mangle] pub extern "C" fn search(_:u32,_:u32,_:u32)->u64{unavailable()}
#[no_mangle] pub extern "C" fn lookup(_:u32,_:u32)->u64{unavailable()}
#[no_mangle] pub extern "C" fn entity(_:u32,_:u32)->u64{unavailable()}
