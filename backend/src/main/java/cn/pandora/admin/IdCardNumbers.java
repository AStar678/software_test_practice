package cn.pandora.admin;

import cn.pandora.common.ApiException;

import java.time.LocalDate;
import java.util.Locale;

/**
 * Administrator-only 18-digit resident ID number: strict format, birthdate, sequence code and
 * checksum (GB 11643-1999) with a normalized uppercase final X. The full value may only be read
 * through the dedicated administrator detail projection; lists carry the masked form and change
 * records only state that the field changed, never the number itself.
 */
public final class IdCardNumbers {
    private IdCardNumbers() {}
    private static final int[] WEIGHTS={7,9,10,5,8,4,2,1,6,3,7,9,10,5,8,4,2};
    private static final char[] CHECK={'1','0','X','9','8','7','6','5','4','3','2'};

    /** Validate and normalize one 18-digit number; the result is the stored canonical form. */
    public static String normalize(Object value,String label,LocalDate today) {
        if(!(value instanceof String raw)) throw bad(label+"必须为文字");
        String text=raw.strip();
        if(text.isEmpty()) throw bad(label+"不能为空");
        if(text.length()!=18) throw bad(label+"须为18位，当前为"+text.length()+"位");
        text=text.toUpperCase(Locale.ROOT);
        for(int i=0;i<17;i++) if(!Character.isDigit(text.charAt(i))) throw bad(label+"前17位须为数字");
        char last=text.charAt(17);
        if(!Character.isDigit(last) && last!='X') throw bad(label+"末位须为数字或大写X");
        LocalDate birth;
        try {
            birth=LocalDate.of(Integer.parseInt(text.substring(6,10)),
                    Integer.parseInt(text.substring(10,12)),Integer.parseInt(text.substring(12,14)));
        } catch(NumberFormatException | java.time.DateTimeException error) {
            throw bad(label+"出生日期段不是有效日期");
        }
        if(birth.isAfter(today)) throw bad(label+"出生日期不得晚于今天");
        if(birth.getYear()<1900) throw bad(label+"出生年份不合法");
        int sum=0;
        for(int i=0;i<17;i++) sum+=(text.charAt(i)-'0')*WEIGHTS[i];
        if(CHECK[sum%11]!=last) throw bad(label+"校验位不正确");
        return text;
    }

    /** List projection form: first 3 and last 4 characters stay readable, the middle is masked. */
    public static String mask(String normalized) {
        if(normalized==null || normalized.length()!=18) return null;
        return normalized.substring(0,3)+"*".repeat(11)+normalized.substring(14);
    }

    private static ApiException bad(String message) { return new ApiException(400,"INVALID_INPUT",message); }
}
